const handleServerError = () => {
  const error = document.createElement('div');
  error.className = 'flash alert';
  error.textContent = 'Action failed. Something went wrong while talking to the server.';
  document.body.appendChild(error);
  setTimeout(() => document.body.removeChild(error), 3000);
}

document.addEventListener('htmx:sendError', handleServerError);
document.addEventListener('htmx:responseError', handleServerError);
document.addEventListener("htmx:afterSettle", init)

function init() {
  // add event listeners here.
}

init()


