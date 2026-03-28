const form = document.getElementById("quote-form");
const response = document.getElementById("form-response");
const photoInput = document.getElementById("photo-input");
const fileHelp = document.getElementById("file-help");
const submitButton = document.getElementById("submit-button");

photoInput.addEventListener("change", () => {
  const files = Array.from(photoInput.files || []);

  if (files.length === 0) {
    fileHelp.textContent = "여러 장 선택할 수 있습니다.";
    return;
  }

  const fileNames = files.map((file) => file.name).join(", ");
  fileHelp.textContent = `${files.length}장 선택됨: ${fileNames}`;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  response.textContent = "메일을 전송하는 중입니다...";
  submitButton.disabled = true;

  try {
    const formData = new FormData(form);
    const request = await fetch("/api/request", {
      method: "POST",
      body: formData,
    });

    const result = await request.json();

    if (!request.ok) {
      throw new Error(result.error || "요청 전송에 실패했습니다.");
    }

    response.textContent = result.message || "메일 전송이 완료되었습니다.";
    form.reset();
    fileHelp.textContent = "여러 장 선택할 수 있습니다.";
  } catch (error) {
    response.textContent = error.message || "오류가 발생했습니다.";
  } finally {
    submitButton.disabled = false;
  }
});
