require("dotenv").config() 
const AWS = require('aws-sdk');
const multer = require('multer')
const multerS3 = require('multer-s3-transform')
const moment = require("moment")
const uuid = require('../utils/uuid')
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region : process.env.REGION
});
const time = moment(new Date()).format("YYYYMMDDhhmmss");
const id = uuid.uuid()

const upload_profile = multer({ 
    storage: multerS3({ 
        s3: s3, 
        bucket: process.env.DBUCKET, // 버킷 이름 입력 
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req, file, cb) => { 
            cb(null, `profile/${id}_${file.originalname}`)
        }
    }),
    limits: {fileSize: 20*1024*1024},
    transform: (req, file, cb) => {
        cb(null, sharp().resize(350,350))
    }
});
const upload_post = multer({ 
    storage: multerS3({ 
        s3: s3, 
        bucket: process.env.DBUCKET, // 버킷 이름 입력 
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req, file, cb) => { 
            cb(null, `post/${id}_${file.originalname}`)
        }
    }),
    limits: {fileSize: 20*1024*1024},
    transform: (req, file, cb) => {
        cb(null, sharp().resize(350,350))
    }
});

function delete_img(filename) {
    s3.deleteObject({
        Bucket: process.env.DBUCKET,
        Key: filename
    }, (err,data) => {
        if(err) {throw err}
        else console.log('s3 파일 삭제 완료.',data)
    }
)}

module.exports.delete_img = delete_img
module.exports.upload_post = upload_post
module.exports.upload_profile = upload_profile
module.exports.time = time
module.exports.id = id
