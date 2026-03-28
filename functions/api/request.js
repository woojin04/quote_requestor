const MAX_ATTACHMENT_SIZE = 7 * 1024 * 1024;

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.RESEND_API_KEY || !env.RESEND_TO_EMAIL || !env.RESEND_FROM_EMAIL) {
    return json(
      {
        error: "메일 설정이 아직 완료되지 않았습니다. 환경 변수를 확인하세요.",
      },
      500,
    );
  }

  try {
    const formData = await request.formData();
    const company = requiredString(formData, "company");
    const brand = requiredString(formData, "brand");
    const quantity = requiredString(formData, "quantity");
    const sku = requiredString(formData, "sku");
    const itemType = requiredString(formData, "itemType");
    const details = optionalString(formData, "details");
    const photoFiles = formData.getAll("photos").filter((value) => value instanceof File);

    const attachments = await Promise.all(
      photoFiles
        .filter((file) => file.size > 0)
        .map(async (file) => ({
          filename: file.name,
          content: await toBase64(file),
          content_type: file.type || "application/octet-stream",
        })),
    );

    const oversized = photoFiles.find((file) => file.size > MAX_ATTACHMENT_SIZE);
    if (oversized) {
      return json(
        {
          error: `${oversized.name} 파일이 너무 큽니다. 7MB 이하 파일만 첨부하세요.`,
        },
        400,
      );
    }

    const submittedAt = new Date().toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
    });

    const payload = {
      from: env.RESEND_FROM_EMAIL,
      to: [env.RESEND_TO_EMAIL],
      subject: `[견적 요청] ${company} / ${brand} / ${sku}`,
      text: [
        "새 견적 요청이 접수되었습니다.",
        "",
        `요청 시각: ${submittedAt}`,
        `요청자 회사: ${company}`,
        `물건 브랜드: ${brand}`,
        `수량: ${quantity}`,
        `품번: ${sku}`,
        `물건 타입: ${itemType}`,
        `부가 설명: ${details || "없음"}`,
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

    const resendResult = await resendResponse.json();

    if (!resendResponse.ok) {
      return json(
        {
          error: resendResult.message || "메일 발송에 실패했습니다.",
          details: resendResult,
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
