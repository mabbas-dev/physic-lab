const app = require('../server');

module.exports = (req, res) => {
    const matched = req.headers['x-matched-path'] || req.headers['x-forwarded-uri'];
    if (matched) {
        req.url = matched.split('?')[0];
    } else if (req.query && req.query.__route) {
        req.url = '/api/' + req.query.__route;
    }
    return app(req, res);
};
