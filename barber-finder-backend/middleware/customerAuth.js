const jwt = require('jsonwebtoken');

// This middleware will be used to protect customer-specific routes
module.exports = function(req, res, next) {
    const token = req.header('x-auth-token');

    if (!token) {
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    try {
        // Verify the token and look for the 'customer' payload
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Add the decoded customer payload to the request object
        req.customer = decoded.customer;
        next();
    } catch (err) {
        res.status(401).json({ msg: 'Token is not valid' });
    }
};
