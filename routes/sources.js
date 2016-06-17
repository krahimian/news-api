/* global require, module */

var express = require('express'),
    router = express.Router(),
    Fetcher = require('fetcher'),
    utils = require('../utils'),
    async = require('async');

router.post('/', utils.isAuthenticated, utils.hasParams(['url']), function(req, res) {

    var url = req.query.url;
    var fetcher = Fetcher(url);

    var saveSource = function(source, cb) {

	req.app.locals.db('sources').select().where('feed_url', source.feed_url).then(function(rows) {

	    if (rows.length) {
		cb(null, rows[0]);
		return;
	    }

	    req.app.locals.db('sources').insert(source).asCallback(cb);

	}).catch(function(e) {
	    cb(e);
	});
    };

    var source = {};

    async.applyEachSeries([
	fetcher.build.bind(fetcher),
	saveSource
    ], source, function(err, result) {
	if (err) {
	    res.status(500).send({ error: err });
	    return;
	}

	res.status(200).send({ source: result });
    });

});

module.exports = router;
