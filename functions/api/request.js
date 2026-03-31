const MAX_ATTACHMENT_SIZE = 7 * 1024 * 1024;
const DEFAULT_FROM_EMAIL = "Acme <onboarding@resend.dev>";

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const formData = await request.formData();
    const debugEnv = String(formData.get("debugEnv") || "") === "1";
    const envStatus = buildEnvStatus(env);

    if (debugEnv) {
      return json(
        {
          message: "Environment variable check completed.",
          env: envStatus,
        },
        200,
      );
    }

    if (!env.RESEND_API_KEY || !env.RESEND_TO_EMAIL) {
      return json(
        {
          error: "Email settings are incomplete. Check the Cloudflare Pages environment variables.",
          env: envStatus,
        },
        500,
      );
    }

    const fromEmail = resolveSenderEmail(env);
    const senderValidationError = validateSenderEmail(fromEmail);
    if (senderValidationError) {
      return json(
        {
          error: senderValidationError,
          env: envStatus,
        },
        500,
      );
    }

    const company = requiredString(formData, "company");
    const brand = requiredString(formData, "brand");
    const quantity = requiredString(formData, "quantity");
    const sku = requiredString(formData, "sku");
    const itemType = requiredString(formData, "itemType");
    const details = optionalString(formData, "details");
    const photoFiles = formData.getAll("photos").filter((value) => value instanceof File);

    const oversized = photoFiles.find((file) => file.size > MAX_ATTACHMENT_SIZE);
    if (oversized) {
      return json(
        {
          error: `${oversized.name} is too large. Attach files up to 7 MB each.`,
        },
        400,
      );
    }

    const attachments = await Promise.all(
      photoFiles
        .filter((file) => file.size > 0)
        .map(async (file) => ({
          filename: file.name,
          content: await toBase64(file),
          content_type: file.type || "application/octet-stream",
        })),
    );

    const submittedAt = new Date().toLocaleString("ko-KR", {
      timeZone: "America/Chicago",
    });

    const payload = {
      from: fromEmail,
      to: [env.RESEND_TO_EMAIL],
      subject: `[Quote Request] ${company} / ${brand} / ${sku}`,
      text: [
        "A new quote request was submitted.",
        "",
        `Submitted at: ${submittedAt}`,
        `Company: ${company}`,
        `Brand: ${brand}`,
        `Quantity: ${quantity}`,
        `SKU: ${sku}`,
        `Item type: ${itemType}`,
        `Details: ${details || "None"}`,
        `Attached photos: ${attachments.length}`,
      ].join("\n"),
      attachments,
    };

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const resendResult = await parseJsonResponse(resendResponse);

    if (!resendResponse.ok) {
      return json(
        {
          error: formatResendError(resendResult),
          details: resendResult,
          env: envStatus,
        },
        502,
      );
    }

    return json(
      {
        message: `${company} request email sent successfully.`,
        id: resendResult.id,
      },
      200,
    );
  } catch (error) {
    return json(
      {
        error: error.message || "An error occurred while handling the request.",
      },
      400,
    );
  }
}

function requiredString(formData, name) {
  const value = optionalString(formData, name);

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function optionalString(formData, name) {
  return String(formData.get(name) || "").trim();
}

async function toBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";

  for (const chunk of bytes) {
    binary += String.fromCharCode(chunk);
  }

  return btoa(binary);
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
    },
  });
}

function buildEnvStatus(env) {
  const resolvedFromEmail = resolveSenderEmail(env);

  return {
    resendApiKeyPresent: Boolean(env.RESEND_API_KEY),
    resendApiKeyMasked: maskValue(env.RESEND_API_KEY),
    resendFromEmailPresent: Boolean(env.RESEND_FROM_EMAIL),
    resendFromEmailMasked: maskEmail(env.RESEND_FROM_EMAIL),
    emailFromPresent: Boolean(env.EMAIL_FROM),
    emailFromMasked: maskEmail(env.EMAIL_FROM),
    effectiveFromEmailMasked: maskEmail(resolvedFromEmail),
    resendToEmailPresent: Boolean(env.RESEND_TO_EMAIL),
    resendToEmailMasked: maskEmail(env.RESEND_TO_EMAIL),
  };
}

function maskValue(value) {
  if (!value) {
    return null;
  }

  if (value.length <= 8) {
    return `${value.slice(0, 2)}***`;
  }

  return `${value.slice(0, 4)}***${value.slice(-4)} (len:${value.length})`;
}

function maskEmail(value) {
  if (!value) {
    return null;
  }

  const normalized = extractEmailAddress(value);
  const [localPart, domain] = normalized.split("@");
  if (!domain) {
    return "***";
  }

  const visibleLocalPart =
    localPart.length <= 2 ? `${localPart.slice(0, 1)}***` : `${localPart.slice(0, 2)}***`;

  return `${visibleLocalPart}@${domain}`;
}

function resolveSenderEmail(env) {
  return String(env.EMAIL_FROM || env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL).trim();
}

function validateSenderEmail(value) {
  const sender = extractEmailAddress(value).toLowerCase();

  if (!sender.includes("@")) {
    return "EMAIL_FROM or RESEND_FROM_EMAIL must be a valid email address.";
  }

  const [, domain] = sender.split("@");

  if (domain === "yourdomain.com") {
    return [
      "The configured sender is still using the placeholder domain yourdomain.com.",
      "Set EMAIL_FROM or RESEND_FROM_EMAIL to onboarding@resend.dev for testing, or use an address on a verified domain in Resend.",
    ].join(" ");
  }

  return null;
}

function extractEmailAddress(value) {
  const input = String(value || "").trim();
  const match = input.match(/<([^>]+)>/);

  return (match ? match[1] : input).trim();
}

function formatResendError(result) {
  const message = String(result?.message || "").trim();

  if (/domain .* not verified/i.test(message)) {
    return [
      message,
      "Update EMAIL_FROM or RESEND_FROM_EMAIL to onboarding@resend.dev for testing, or verify the sender domain in Resend and use an address on that domain.",
    ].join(" ");
  }

  return message || "Email delivery failed.";
}

async function parseJsonResponse(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      message: `Upstream service returned a non-JSON response. (HTTP ${response.status})`,
      raw: text,
    };
  }
}
