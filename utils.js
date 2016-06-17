/* global module */

var hasParams = function(params) {
    return function(req, res, next) {
	var missing, exists = true;
	exists = params.every(function(param) {
	    if (!req.query[param]) {
		missing = param;
		return false;
	    }
	    return true;
	});
	
	if (!exists) {
	    res.status(400).send({
		message: 'missing param: ' + missing,
		session: req.user
	    });
	} else {
	    next();
	}
    };
};
var isAuthenticated = function(req, res, next) {
    if (!req.user) {
	res.status(401).send({
	    data: 'no session',
	    session: null
	});
    } else {
	next();
    }
};

module.exports = {
    hasParams: hasParams,
    isAuthenticated: isAuthenticated
};
