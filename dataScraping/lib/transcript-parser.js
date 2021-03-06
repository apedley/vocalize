var watson = require('watson-developer-cloud');
var fs = require('fs');
var spawn = require('child_process').spawn;
var path = require('path');
var BbPromise = require('bluebird');
var readdir = BbPromise.promisify(fs.readdir);
var config = require('./config/config');
var util = require('./util');

var speech_to_text = watson.speech_to_text({
  username: config.username,
  password: config.password,
  version: 'v1',
  url: 'https://stream.watsonplatform.net/speech-to-text/api',
});

/**
 * List of language models available for Watson
 * https://www.ibm.com/smarterplanet/us/en/ibmwatson/developercloud/doc/speech-to-text/using.shtml#models
 * @type {Object}
 */
var speech_to_text_language_models = {
  'english': 'en-US_BroadbandModel',
  'english-uk': 'en-UK_BroadbandModel',
  'spanish': 'es-ES_BroadbandModel',
  'portugese': 'pt-BR_BroadbandModel',
  'japanese': 'ja-JP_BroadbandModel',
  'mandarin': 'zh-CN_BroadbandModel'
};

var inputDir = config.inputDir;
/**
 * Queries Watson to get the transcript of an audio file with timestamps
 * @param  {[string]} audioFilename [filename of the audio file]
 * @param  {[string]} audioFilepath [(optional) filepath - defaults to config.inputDir]
 * @return {[BbPromise]}            [Resolves with transcript file path]
 */
exports.getTranscript = function(videoId, language) {

  var audioFileDirectory;
  var transcriptDir;
  var languageModel;

  return new BbPromise(function(resolve, reject) {

      if (!videoId) {
        reject('No Video Id Specified for Transcript Parser');
      }

      if (!language) {
        reject('No Language Specified for Transcript Parser');
      }

      audioFileDirectory = path.join(inputDir, videoId);
      transcriptDir = path.join(inputDir, videoId, 'transcripts');
      languageModel;

      languageModel = speech_to_text_language_models[language];

      if (!languageModel) {
        reject('Watson does not support that language');
      } else {
        console.log('Getting transcript for ' + videoId + ' in ' + language);
        resolve();
      }
    }).then(function() {
      return readdir(audioFileDirectory)
    })
    .then(function(files) {

      var transcriptProcesses = files.filter(function(file) {
          return path.extname(file) === '.flac';
        })
        .map(function(file, idx) {
          var filePath = path.join(audioFileDirectory, file);
          return exports._watsonStream.bind(this, filePath, transcriptDir, languageModel);
        });

      return BbPromise.map(transcriptProcesses, function(process) {
        return process();
      }, {concurrency: config.concurrencyLimit});
    });

};

exports._watsonStream = function(audioFile, transcriptDir, languageModel) {

  return new BbPromise(function(resolve, reject) {

    var ext = path.extname(audioFile);
    var filename = path.basename(audioFile, ext);

    var watson_process = spawn('node', ['./dataScraping/lib/spawn/watsonTranscriber.js', audioFile, transcriptDir, languageModel]);

    watson_process.stdout.on('data', function(data){
      console.log(data.toString());
    });

    watson_process.stderr.on('data', function(err){
      reject(err.toString());
    });

    watson_process.on('exit', function(){
      resolve();
    });

  });
};
