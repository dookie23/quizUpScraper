var request = require('request');
var async = require('async');
var fs = require('fs');
var glob = require('glob');
var _ = require('lodash');

var config = require('./config');

var USER = config.user;
var PROFILE_PATH = config.firefoxProfilePath;
var ROOT_PATH = config.output;

var GET_HISTORY = config.urls.history;
var OUTPUT_HISTORY = ROOT_PATH + '/' + USER + '-history';

var GET_GAMES = config.urls.games;
var OUTPUT_GAMES = ROOT_PATH + USER + '/';

var OUTPUT_CATEGORIES = ROOT_PATH + USER + '-categories';
var OUPUT_QUESTIONS = ROOT_PATH + USER + '-questions';

var CONF = {
  obtainHistory: config.actions.getGameHistory,
  obtainGames: config.actions.getGames,
  obtainQuestions: config.actions.getQuestions
};

var webdriver = require('selenium-webdriver'),
  By = require('selenium-webdriver').By,
  until = require('selenium-webdriver').until;

var firefox = require('selenium-webdriver/firefox');

var options = new firefox.Options().setProfile(new firefox.Profile(PROFILE_PATH));

var driver = null;

var saveJSON = function(path, data, cb) {

console.log(path);
  return fs.writeFile(path + '.json', JSON.stringify(data),
    function(err) {
      if (err) {
        return console.log(err);
      }
      console.log('A file was saved for %s', USER);
      return cb();
    });
};

var getAndSave = function(driver, url, path, cb) {
  try {
    var x = driver.get(url);
    driver.getPageSource().then(function(d) {
      return saveJSON(path, JSON.parse(d.split('<pre>')[1].split('</pre>')[0]), cb);
    });
  } catch (err) {
    return cb(err);
  }
};

var obtainHistory = function() {

  console.log('Obtaining history for %s', USER);

  return function(cbObtain) {

    driver = new webdriver.Builder().
    forBrowser('firefox').
    withCapabilities(webdriver.Capabilities.firefox()).
    setFirefoxOptions(options).
    build();
    fs.mkdir(ROOT_PATH, function(err, result) {
      if (err && err.code !== 'EEXIST') return cbObtain();
      	return getAndSave(driver, GET_HISTORY, OUTPUT_HISTORY, function(err, result) {
        driver.quit();
        cbObtain();
      });
    });
  };
};

var obtainGames = function() {

  console.log('Obtaining games for %s', USER);

  return function(cbObtain) {
    var todos = null;

    try {
      todos = require(OUTPUT_HISTORY);

      driver = new webdriver.Builder().
      forBrowser('firefox').
      withCapabilities(webdriver.Capabilities.firefox()).
      setFirefoxOptions(options).
      build();

      if (todos && todos.games) {

        fs.mkdir(OUTPUT_GAMES, function(err, result) {
          if (err && err.code !== 'EEXIST') return cbObtain(err);
          var categories = {};
          async.eachSeries(todos.games, function(item, cb) {
          		categories[item.topic.slug] = {
          			id: item.topic.slug,
          			name: item.topic.name,
          			description: item.topic.description,
          			icon_url: item.topic.icon_url
          		};
              return getAndSave(driver, GET_GAMES + item.game_id, OUTPUT_GAMES + item.game_id, cb);
            },
            function(err, results) {
              driver.quit();
              return saveJSON(OUTPUT_CATEGORIES, categories, cbObtain);
            });
        });

      } else cbObtain();
    } catch (err) {
      console.log('ERROR retrieving games %s', err);
      return cbObtain();
    }
  };
};

var obtainQuestions = function() {
  return function(cb) {
    var questions = [];

    glob(OUTPUT_GAMES + '**/*.json', {}, function(err, files) {
      async.eachSeries(files, function iterator(file, cbFile) {
        var json = require(file);
        if (json.result && json.result.game && json.result.game.questions) {
          for (var i = 0; i < json.result.game.questions.length; i++) {
            var quQuestion = json.result.game.questions[i];
            var question = {};
            question.text = quQuestion.text;
     		
            question.category = json.result.topic_slug;
            question.language = (_.startsWith(json.result.topic_slug, 'es-')) ? 'es' : 'en';
            if (quQuestion.answers) {
              question.type = quQuestion.type;
              question.options = [];
              question.no_correct = [];
              question.correct = [];
              question.image = null;
              if (quQuestion.resources && quQuestion.resources.pictures && quQuestion.resources.pictures[0] && quQuestion.resources.pictures[0].formats && quQuestion.resources.pictures[0].formats.jpg)  question.image = quQuestion.resources.pictures[0].formats.jpg.url;
              for (var j = 0; j < quQuestion.answers.length; j++) {
                var answer = quQuestion.answers[j];

                if (answer.correct) {
                  question.options.unshift(answer.text);
                  question.correct.push(answer.text);
                } else {
                  question.options.push(answer.text);
                  question.no_correct.push(answer.text);
                }
                //console.log(answer.correct + ' ' + answer.text);
              }
            }
            //console.log('\n');
            questions.push(question);
          }
        }
        return cbFile();
      }, function(err, result) {
        console.log('Questions %s', questions.length);
        return saveJSON(OUPUT_QUESTIONS, questions, cb)
      });
    });
  };
};

var series = [];
if (CONF.obtainHistory) series.push(obtainHistory());
if (CONF.obtainGames) series.push(obtainGames());
if (CONF.obtainQuestions) series.push(obtainQuestions());

async.series(series, function(err, results) {
  console.log('Finished!');
});
