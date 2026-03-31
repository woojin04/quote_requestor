const MAX_ATTACHMENT_SIZE = 7 * 1024 * 1024;

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

    if (!env.RESEND_API_KEY || !env.RESEND_TO_EMAIL || !env.RESEND_FROM_EMAIL) {
      return json(
        {
          error: "메일 설정이 아직 완료되지 않았습니다. 환경 변수를 확인하세요.",
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
          error: `${oversized.name} 파일이 너무 큽니다. 7MB 이하 파일만 첨부하세요.`,
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
      from: env.RESEND_FROM_EMAIL,
      to: [env.RESEND_TO_EMAIL],
      subject: `[견적 요청] ${company} / ${brand} / ${sku}`,
      text: [
        "새 견적 요청이 접수되었습니다.",
        "",
        `요청 시각: ${submittedAt}`,
        `요청 업체: ${company}`,
        `브랜드: ${brand}`,
        `수량: ${quantity}`,
        `SKU: ${sku}`,
        `품목 타입: ${itemType}`,
        `추가 설명: ${details || "없음"}`,
        `첨부 사진 수: ${attachments.length}`,
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
          error: resendResult.message || "메일 발송에 실패했습니다.",
          details: resendResult,
          env: envStatus,
        },
        502,
      );
    }

    return json(
      {
        message: `${company} 요청이 메일로 발송되었습니다.`,
        id: resendResult.id,
      },
      200,
    );
  } catch (error) {
    return json(
      {
        error: error.message || "처리 중 오류가 발생했습니다.",
      },
      400,
    );
  }
}

function requiredString(formData, name) {
  const value = optionalString(formData, name);

  if (!value) {
    throw new Error(`${name} 값이 비어 있습니다.`);
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
  return {
    resendApiKeyPresent: Boolean(env.RESEND_API_KEY),
    resendApiKeyMasked: maskValue(env.RESEND_API_KEY),
    resendFromEmailPresent: Boolean(env.RESEND_FROM_EMAIL),
    resendFromEmailMasked: maskEmail(env.RESEND_FROM_EMAIL),
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

  const [localPart, domain] = value.split("@");
  if (!domain) {
    return "***";
  }

  const visibleLocalPart =
    localPart.length <= 2 ? `${localPart.slice(0, 1)}***` : `${localPart.slice(0, 2)}***`;

  return `${visibleLocalPart}@${domain}`;
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
