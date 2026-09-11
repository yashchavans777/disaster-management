export const getApiErrorMessage = (error, fallbackMessage) => {
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }

  if (error?.message === 'Network Error') {
    return fallbackMessage;
  }

  return error?.message || fallbackMessage;
};
