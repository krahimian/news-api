/* global require, module */

var express = require('express'),
    router = express.Router(),
    Fetcher = require('fetcher'),
    utils = require('../utils'),
    async = require('async');

router.post('/', utils.isAuthenticated, utils.hasParams(['url']), function(req, res) {

    var url = req.query.url;
    var fetcher = Fetcher(url);
    var source = {};

    async.waterfall([
	function(cb) {
	    fetcher.build(source, cb);
	},
	function(cb) {
	    fetcher.getPosts(source, cb);
	}
    ], function(err) {
	res.status(err ? 500 : 200).send(err ? { error: err } : source);
    });

});

module.exports = router;
