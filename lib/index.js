var Stream  = require('stream')
,   Promise = global.Promise || require('bluebird')
,   Busboy  = require('busboy')
,   async   = require('async')
,   extend  = require('ampersand-class-extend');

/**
 * Base Class
 */
class Glimmer {
  static register (key, uploader) {
    this.uploaders[key] = uploader;
  }

  static parse (context, options, done) {
    options = options || {};
    context = context.req || context;

    var self   = this
    ,   parser = new Busboy({ headers: context.headers })
    ,   deferred;

    context.pipe(parser);

    deferred = new Promise(function (resolve, reject) {
      var count = 0
      ,   files = {}
      ,   onEnd;

      onEnd = function () {
        if (0 !== count) return;
        return resolve(files);
      };

      parser.on('error', function (err) {
        return reject(err);
      });

      parser.on('file', function (fieldname, stream, filename, enc, mime) {
        let mapping  = options[fieldname]
        ,   Uploader = self.uploaders[mapping];

        if (!mapping || !Uploader) return stream.resume();

        count++;

        new Uploader(stream, filename).save().then(function (stored) {
          count--;
          files[fieldname] = stored;
          onEnd();
        }, function (err) {
          return reject(err);
        });
      });

      parser.on('finish', function () {
        onEnd();
      });
    });

    if (done) {
      deferred.then(function (stored) {
        done(null, stored);
      }, done);
    }

    return deferred;
  }
}

Glimmer.uploaders = {};

/**
 * Uploader
 */
class Uploader {
  constructor (source, filename) {
    if (!source) throw new Error('Please pass a source stream.');

    this.source       = source;
    this.input        = new Stream.PassThrough();
    this.filename     = filename;
    this.transformers = [];

    if (this.filename) this.validate();

    this.source.pipe(this.input);
    this.configure();
  }

  configure () {}

  transform (method) {
    this.transformers.push(method);
  }

  validate () {

  }

  save () {
    var self = this;
    return new Promise(function (resolve, reject) {
      async.map(self.transformers, function (transformer, next) {
        if (!this[transformer]) return next();
        this[transformer](next)
      }.bind(self), function (err, saved) {
        if (err) return reject(err);
        resolve(saved);
      });
    });
  }
}

/**
 * Class Methods
 */
Uploader.extend = extend;

/**
 * Expose Glimmer
 */
exports = module.exports = Glimmer;
exports.Uploader = Uploader;