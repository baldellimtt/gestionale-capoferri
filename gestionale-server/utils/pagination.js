/**
 * Utilities per paginazione
 * Incrementale, non distruttivo
 */

class Pagination {
  /**
   * Estrae parametri di paginazione da query
   */
  static getParams(req, defaultLimit = 20, maxLimit = 100) {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(maxLimit, Math.max(1, parseInt(req.query.limit) || defaultLimit));
    const offset = (page - 1) * limit;

    return { page, limit, offset };
  }

  /**
   * Crea risposta paginata
   */
  static createResponse(data, total, page, limit) {
    const totalPages = Math.ceil(total / limit);
    
    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  /**
   * Aggiunge LIMIT e OFFSET a query SQL
   */
  static addLimitOffset(query, limit, offset) {
    return `${query} LIMIT ? OFFSET ?`;
  }
}

module.exports = Pagination;



