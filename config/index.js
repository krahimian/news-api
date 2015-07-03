/* global require, module */

var fs = require('fs');

var config;
var config_file = '/home/deploy/apps.json';

if (fs.existsSync(config_file)) {

    config = JSON.parse(fs.readFileSync(config_file));

    var db = config.servers.filter(function(s) {
	return s.roles.indexOf('db') > -1;
    })[0];

    config.db.host = db.internal_ip;

} else {

    config = {
	log: {
	    level: 'debug'
	},	
	db: {
	    database: 'news_development',
	    host: 'localhost',
	    port: 3306,
	    user: 'root',
	    charset  : 'UTF8_GENERAL_CI'
	}
    };
}

if (!config) {
    throw new Error('Application config missing');
}

module.exports = config;
