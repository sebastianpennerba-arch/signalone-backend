// ============================================================
// Standardized API Response Helpers
// ============================================================

module.exports = {
  success: (data) => ({
    ok: true,
    data
  }),
  
  error: (message, details = null) => {
    const response = {
      ok: false,
      error: message
    };
    
    if (details) {
      response.details = details;
    }
    
    return response;
  },
  
  paginated: (data, pagination) => ({
    ok: true,
    data,
    pagination: {
      page: pagination.page || 1,
      limit: pagination.limit || 50,
      total: pagination.total || data.length,
      hasMore: pagination.hasMore || false
    }
  })
};
