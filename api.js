const API_BASE_URL = (window.EXPENSE_API_BASE_URL || 'http://127.0.0.1:5000').replace(/\/+$/, '');

async function apiRequest(path, options = {}) {
  const { redirectOnUnauthorized = true, ...requestOptions } = options;
  const headers = { ...requestOptions.headers };
  if (requestOptions.body && !(requestOptions.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...requestOptions,
      headers,
      credentials: 'include'
    });
  } catch (error) {
    throw new Error('Could not connect to the Flask server. Start the backend and try again.');
  }

  let result = {};
  if (response.status !== 204) {
    try {
      result = await response.json();
    } catch (error) {
      throw new Error(`The server returned an invalid response (HTTP ${response.status}).`);
    }
  }

  if (response.status === 401 && redirectOnUnauthorized) {
    window.location.replace('/login');
    const error = new Error('Your session has ended. Please sign in again.');
    error.status = response.status;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(result.message || 'The request could not be completed.');
    error.status = response.status;
    throw error;
  }
  return result;
}

window.ExpenseAPI = Object.freeze({ baseUrl: API_BASE_URL, request: apiRequest });
