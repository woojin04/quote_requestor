const form = document.getElementById("quote-form");
const response = document.getElementById("form-response");

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const data = new FormData(form);
  const name = data.get("name");
  const projectType = data.get("projectType");

  response.textContent = `${name}, your ${projectType.toString().toLowerCase()} request has been captured for review.`;
  form.reset();
});
