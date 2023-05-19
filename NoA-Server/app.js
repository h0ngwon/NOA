require("dotenv").config()
const express = require("express")
const http = require("http")
const app = express();
const path = require("path")
const server = http.createServer(app)

const authJWT = require("./middlewares/authJWT/authJWT");

const io = require('socket.io')(server)
const PORT = process.env.PORT || 5000;
const connection = require('./config/dbconfig.js'); //db
const upload = require('./config/s3profile.js') //s3

const { json } = require("express/lib/response");
const moment = require("moment")
// const {v4} = require('uuid')
// const uuid = () => {
//     const tokens = v4().split('-')
//     return tokens[2] + tokens[1] + tokens[0] + tokens[3] + tokens[4]
// }
const uuid = require('./utils/uuid')
//login module
const jwt = require('./utils/jwt-utils')
const userRouter = require("./router/userRouter");
app.use("/", userRouter);

app.use(express.urlencoded({extended: true}))
app.use(express.static(path.join(__dirname,"src")))
app.use(express.json())
const cors = require('cors')
app.use(cors())

// const pushMessage = require('')

app.all('/*', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
});

//apis

app.post("/login", (req, res) => {
    const { user_nickname, user_wallet } = req.body; //JSON 객체
    const query =
        "select user_code from user where user_nickname=? and user_wallet=?";
    const param = [user_nickname, user_wallet];
    connection.query(query, param, function (err, result, fields) {
        if (!result[0]) {
            res.send({
                status_code: 401,
                message:
                    "Not Authorized : User does not exist or wallet address does not exist.",
            });
        } else {
            const data = JSON.stringify(result[0].user_code);
            const user_code = JSON.parse(data);
            const accessToken = jwt.sign(req.body);
            const refreshToken = jwt.refresh();
            const tokenQuery =
                "update user set user_token =? where user_code=?";
            const tokenParam = [refreshToken, user_code];
            connection.query(
                tokenQuery,
                tokenParam,
                function (err, result, fields) {
                    console.log(result);
                    if (err) throw err;
                }
            );
            res.send({
                status_code: 200,
                data: {
                    user_code,
                    accessToken,
                    refreshToken,
                },
            });
        }
    });
});

app.put('/change-desc', (req,res) => {
    const {user_code, desc} = req.body
    let query = "update user set user_desc = ? where user_code =?;"
    let params = [desc,user_code]
    connection.query(query,params,function(err, result, fields){
        if (err) {
            res.json({status_code: 401, message: err})
            console.log(err)
        }
        else {
            res.json({status_code: 200, message: '상태메시지 변경 완료!'})
            console.log(result)
        }
    }) 
}) // 상태메시지 변경

app.put('/change-profile', upload.upload_profile.single("img"),  (req,res) => {
    const url = `https://noa-profile.s3.ap-northeast-2.amazonaws.com/profile/${upload.id}_${req.file.originalname}`
    const {user_code} = req.body
    let query = 'select user_profile from user where user_code =?;'
    let param = [user_code]
    connection.query(query,param,function(err,result,fields){
        if (err) {
            res.json({status_code: 401, message: err})
        }
        else {
            console.log(result[0])
            let file_name = JSON.stringify(result[0])
            let file = JSON.parse(file_name)
            let del_file = file.user_profile
            del_file = del_file.substring(60)
            if(file.user_profile != 'default-profile.png') {
                upload.delete_img(del_file)
                console.log('s3 데이터 삭제 완료')
            }
            query = 'update user set user_profile=? where user_code=?;'
            param = [url,user_code]
            connection.query(query,param,function(err,rows,fields){
                if (err) {
                    res.json({status_code: 401, message: err})
                }
                else {
                    res.json({status_code: 200, message: url})
                    console.log('change complete')
                }
            })         
        }
    })
    
    
})// (회원정보 수정) 프로필 바꾸기
//이미지 가져올때는 https://noa-profile.s3.ap-northeast-2.amazonaws.com/ + url

app.delete('/delete-profile', (req,res) => {
    const {user_code} = req.body
    let query = 'select user_profile from user where user_code =?;'
    let param = [user_code]
    let default_profile = 'https://noa-profile.s3.ap-northeast-2.amazonaws.com/profile/default-profile.png'
    connection.query(query,param,function(err,result,fields){
        if (err) {
            res.json({status_code: 401, message: err})
        }
        else {
            console.log(result[0])
            let file_name = JSON.stringify(result[0])
            let file = JSON.parse(file_name)
            let del_file = file.user_profile
            del_file = del_file.substring(60)
            if(file.user_profile != 'default-profile.png') {
                upload.delete_img(del_file)
                console.log('s3 데이터 삭제 완료')
            }
            
            query = "update user set user_profile=? where user_code=?"
            param = [default_profile, user_code]
            connection.query(query,param,function(err,result,rields){
                if (err) {
                    res.json({status_code: 401, message: err})
                }
                else res.json({status_code:200,message:'기본 이미지로 변경 완료.'})
            })
        }
    })
    
})// 회원 프로필 삭제 --> 프로필을 비우는 것(기본이미지)을 뜻함
//input : img - (type file), user_code
//이미지 가져올때는 https://noa-profile.s3.ap-northeast-2.amazonaws.com/ + url

app.post('/posting', upload.upload_post.single("img"), (req,res) => {
    const url = `https://noa-profile.s3.ap-northeast-2.amazonaws.com/post/${upload.id}_${req.file.originalname}`
    const {post_owner, post_nft, post_title, post_text,post_tag} = req.body
    let query = 'insert into post (post_owner, post_liked, post_nft, post_title, post_img, post_text, post_tag, post_report) values(?,0,?,?,?,?,?,0);'
    let param = [post_owner,post_nft,post_title,url,post_text,post_tag]
    connection.query(query,param,function(err,rows,fields){
        if (err) {
            res.json({status_code: 401, message: err})
        }
        else {
            console.log('포스팅 잘 됨')
            res.json({status_code: 200, message: url})
        }
    })
})// 포스팅 (이미지 S3 업로드 포함)
//이미지 가져올때는 https://noa-profile.s3.ap-northeast-2.amazonaws.com/ + url

app.delete('/delete-posting', (req,res) => {
    const {post_id} = req.body
    let query = 'select post_img from post where post_id =?;'
    let param = [post_id]
    connection.query(query,param,function(err,result,fields){
        if (err) {
            res.json({status_code: 401, message: err})
        }
        else{
            console.log(result[0])
            let file_name = JSON.stringify(result[0])
            let file = JSON.parse(file_name)
            console.log(file.post_img)
            upload.delete_img(file.post_img)
            res.json({status_code:200,message:'s3 프로필 데이터 삭제 완료.'})
            query = "delete from post where post_id=?"
            connection.query(query,param,function(err,result,rields){
                if (err) {
                    res.json({status_code: 401, message: err})
                }
                else console.log('DB에서도 삭제 완료.')
            })
        }
    })
    
})// 포스팅 이미지 S3에서 삭제
//이미지 가져올때는 https://noa-profile.s3.ap-northeast-2.amazonaws.com/folder_name/file_name

app.get('/self-user-info',authJWT,(req,res) => {
    const {user_code} = req.query
    let query = "select * from user where user_code=?"
    let param = [user_code]
    connection.query(query,param,function(err, result, fields) {
        if (err) console.log(err)
        else res.json(result[0])
    })
})

app.get('/user-info',(req,res) => {
    const {user_code,other} = req.query
    let query = "select * from user where user_code=?"
    let param = [other]
    let resmsg
    connection.query(query,param,function(err, result, fields) {
        if (err) console.log(err)
        else {
            query = "select count(*)'count' from user,reportuser where user.user_code = reportuser.user_code and reportuser.user_code=? and reported = ?"
            param = [user_code,other]
            resmsg=result
            connection.query(query,param,function(err, result, fields) {
                resmsg = {user_code: parseInt(other), user_nickname: resmsg[0].user_nickname,
                    user_profile: resmsg[0].user_profile, user_wallet: resmsg[0].user_wallet,
                    user_report: resmsg[0].user_report, user_desc: resmsg[0].user_desc,
                    I_report_this_user: 0, isfriend: 0}
                if (err) console.log(err)
                else {
                    if(result[0].count != 0) resmsg.I_report_this_user = 1
                    query = "select count(*)'count' from user,friend where user.user_code = friend.user_code and friend.user_code=? and friend_code =?;"
                    param = [user_code,other]
                    connection.query(query,param,function(err, result, fields) {
                        if (err) console.log(err)
                        else {
                            if(result[0].count != 0) resmsg.isfriend = 1
                            res.json(resmsg)
                        }
                    })
                }
            })
        }
    })
})

app.get('/rooms', (req,res) => {
    const {user_code} = req.query
    let query = "select room_id,last_msg,last_created from chatroom where user_code=?;"
    let params = [user_code]
    let msg
    // msg ={room_id:0, 
    //     owner:{nickname:'',user_id:0,profile:''},
    //     message:{message:'',created:'',unread_message_count:0}}
    connection.query(query,params,function(err, result, fields){
        if (err) console.log(err)
        else {
            //console.log(result)
            msg = result
            for(let i=0;i<result.length;i++){
                msg[i] = {room_id:result[i].room_id, 
                    owner:{nickname:'',user_code:0,profile:''},
                    message:{message:result[i].last_msg,created:result[i].last_created,unread_message_count:0}}
            }
            //console.log(msg)
            query = "select room_id,count(*)'count' from chatting where read_state = 1 and msg_to = (select user_nickname from user where user_code =?);"
            params = [user_code]
            connection.query(query,params,function(err, results, fields){
                if (err) console.log(err)
                else {
                    for(let i=0;i<msg.length;i++){
                        for(let j=0;j<results.length;j++){
                            if(msg[i].room_id == results[j].room_id){
                                msg[i].message.unread_message_count=results[j].count
                            }
                        }
                    }
                    //res.json(msg)
                    query = "select room_id,user_nickname,user.user_code, user_profile from user,chatroom where chatroom.user_code = user.user_code and user.user_code != ? and room_id in (select room_id from chatroom where user_code=?);"
                    params = [user_code,user_code]
                    connection.query(query,params,function(err, result1, fields){
                        if (err) console.log(err)
                        else {
                            for(let i=0;i<msg.length;i++){
                                for(let j=0;j<result1.length;j++){
                                    if(msg[i].room_id == result1[j].room_id){
                                        msg[i].owner.nickname=result1[j].user_nickname
                                        msg[i].owner.profile=result1[j].user_profile
                                        msg[i].owner.user_code=result1[j].user_code
                                    }
                                }
                            }
                            //console.log(result1)
                            res.json(msg)
                        }
                    }) 
                }
            }) 
        }
    }) 
})//user가 속한 채팅방 목록
//[{"room_id": 1},{"room_id": 2}]

app.get('/msg', (req,res) => {
    const {room_id,page} = req.query
    let query = "select * from chatting where room_id=? order by msg_num desc limit 10 offset ?;"
    let params = [room_id,parseInt(page)*10]
    connection.query(query,params,function(err, result, fields){
        if (err) console.log(err)
        else res.json(result)
    }) 
})//room에 있는 메시지 가져오기 최근 메시지부터 10개씩 가져옴. 순차적으로 client쪽에서 보여주기 위해서는
//msg_num순으로 정렬시키면 될듯.
// [
//     {
//     "room_id": 1,
//     "msg_to": "나희도",
//     "msg_from": "백이진",
//     "msg_content": "음~",
//     "created": "05-21 06:20",
//     "read_state": 1,
//     "msg_num": 7
// },
// {
//     "room_id": 1,
//     "msg_to": "백이진",
//     "msg_from": "나희도",
//     "msg_content": "최종임 아마?",
//     "created": "05-20 11:20",
//     "read_state": 1,
//     "msg_num": 6
// },
// ...
// ]

app.post('/chat-msg',(req,res) => {
    const {room_id, msg_to, msg_from, msg_content, created, read_state} = req.body
    let query = 'insert into chatting (room_id,msg_to,msg_from,msg_content,created,read_state) values (?,?,?,?,?,?);'
    let param = [room_id,msg_to,msg_from,msg_content,created,read_state]
    connection.query(query,param,function(err,rows,fields){
        if (err) {
            res.json({status_code: 401, message: err})
        }
        else res.json({status_code: 200, message: '메시지 입력 완료'})
    })
})//메시지 DB에 입력
//x-www-form-urlencoded 형식으로 데이터 전송했음. (post-man기준)
//메시지 보낼때 상대방의 room join 여부에 따라 read_state 조정해야 할듯.

app.put('/chat-read', (req,res) => {
    const {user_code, room_id} = req.body
    let query = "update chatting set read_state = 0 where msg_to =(select user_nickname from user where user_code=?) and room_id=?;"
    let params = [user_code,room_id]
    connection.query(query,params,function(err, result, fields){
        if (err) {
            res.json({status_code: 401, message: err})
        }
        else{
            res.json({status_code: 200, message: '메시지 읽음'})
            console.log('읽음.')
        }
    }) 
})//메시지 읽음 처리
//x-www-form-urlencoded 형식으로 데이터 전송했음. (post-man기준)

app.get('/chat-non-read-count', (req,res) => {
    const {room_id, user_code} = req.query
    let query = "select count(msg_num)'count' from chatting where room_id =? and msg_to = (select user_nickname from user where user_code=?) and read_state=1;"
    let params = [room_id, user_code]
    connection.query(query,params,function(err, result, fields){
        if (err) console.log(err)
        else{
            res.json({'status_code': 200, 'message': '메시지 읽음'})
            console.log('읽음.')
        }
    }) 
})//안읽은 메시지 개수

app.post('/make-chatroom', (req,res) => {
    const {user_code, partner_code} = req.body
    let query = "select count(user2.room_id)'count' from (select room_id from chatroom where user_code=?) as user1, (select room_id from chatroom where user_code=?) as user2 where user1.room_id = user2.room_id;"
    let param = [user_code, partner_code]
    connection.query(query,param,function(err, result, fields) {
        if (err) console.log(err)
        else {
            if(result[0].count ==0) { //파라미터로 받은 유저 사이의 채팅룸이 존재x:
                query = "select max(room_id)'max' from chatroom;"                              
                connection.query(query,function(err, result, fields) {
                    if (err) console.log(err)
                    else {
                        let max_room_num = result[0].max+1
                        query = "insert into chatroom (user_code, room_id,last_msg,last_created) values (?,?,'','');"
                        param = [user_code, max_room_num]
                        connection.query(query,param,function(err, result, fields) {
                            if (err) console.log(err)
                            else {
                                query = "insert into chatroom (user_code, room_id,last_msg,last_created) values (?,?,'','');"
                                param = [partner_code, max_room_num]
                                connection.query(query,param,function(err, result, fields) {
                                    if (err) console.log(err)
                                    else {
                                        res.json({status_code: 200, message: max_room_num})
                                    }
                                })
                            }
                        })
                    }
                })
                
            }
            else{//이미 방 존재:
                res.json({status_code: 401, message: '이미 채팅방이 존재합니다.'})
            }
        }
    })
})

app.put('/post-liked', (req,res) => {
    const {post_id,user_code} = req.body
    let query = "select count(*)'count' from postlike where user = ? and post=?;"
    let params = [user_code, post_id]
    connection.query(query,params,function(err, result, fields){
        if (err) {
            res.json({status_code: 401, message: err})
        }
        else{
            console.log('count:',result[0].count)
            if(result[0].count == 0) {
                query = "update post set post_liked= post_liked+1 where post_id=?;"
                params = [post_id]
                connection.query(query,params,function(err, result, fields){
                    if (err) {
                        res.json({status_code: 401, message: err})
                    }
                    else{
                        query = "insert into postlike (user, post) values (?,?);"
                        params = [user_code,post_id]
                        connection.query(query,params,function(err, result, fields){
                            if (err) {
                                res.json({status_code: 401, message: err})
                            }
                            else{
                                res.json({status_code: 200, message: '좋아요+1'})
                                console.log('좋아요 +1')
                            }
                        })
                    }
                })
            }
            else {
                query = "update post set post_liked= post_liked-1 where post_id=?;"
                params = [post_id]
                connection.query(query,params,function(err, result, fields){
                    if (err) {
                        res.json({status_code: 401, message: err})
                    }
                    else{
                        query = "delete from postlike where user = ? and post = ?;"
                        params = [user_code, post_id]
                        connection.query(query,params,function(err, result, fields){
                            if (err) {
                                res.json({status_code: 401, message: err})
                            }
                            else{                                
                                res.json({status_code: 200, message: '좋아요 취소'})
                                console.log('좋아요 취소')
                            }
                        })                        
                    }
                })

            }
        }    
    }) 
})//post 좋아요

app.get('/post-liked-rank', (req,res) => {
    let query = "select post_id, post_img from post where post_liked != 0 order by post_liked desc limit 9 offset 0;"
    connection.query(query,function(err, result, fields){
        if (err) console.log(err)
        else {
            for(let i=0;i<result.length;i++){
                let tmp
                tmp = result[i].post_img
                tmp = tmp.substring(52)
                result[i].post_img = tmp
            }
            res.json(result)
        }
    }) 
})// 좋아요 랭킹 9위까지 리턴(post_id) 좋아요 수 많은 순서로 반환함

app.post('/post-rank',(req,res) => {
    const {one, two, three, four, five, six, seven, eight, nine} = req.body
    let query = 'insert into gallarypost (id) values (?),(?),(?),(?),(?),(?),(?),(?),(?);'
    let param = [one, two, three, four, five, six, seven, eight, nine]
    connection.query(query,param,function(err,rows,fields){
        if (err) {
            res.json({status_code: 401, message: err})
        }
        else res.json({status_code: 200, message: '랭킹 등록 완료.'})
    })
}) // gallarypost에 랭킹 등록. --> 다음달에 좋아요 수를 깎기 위함. (누적 통계 독점 방지)

app.delete('/init-post-rank',(req,res) => {
    let query = 'delete from gallarypost where id>=1;'
    connection.query(query,function(err,rows,fields){
        if (err) {
            res.json({status_code: 401, message: err})
        }
        else{
            console.log('랭킹 초기화 완료')
            res.json({status_code: 200, message: '랭킹 초기화 완료'})
        }
    })
})// gallarypost에 등록된 랭킹 post 초기화. 초기화 후 아래의 post-rank 쓰면 됨.

app.get('/user-all-post-num', (req,res) => {
    const {user_code} = req.query
    let query = "select count(*)'count' from post where post_owner=(select user_nickname from user where user_code=?);"
    let params = [user_code]
    connection.query(query,params,function(err, result, fields){
        if (err) console.log(err)
        else res.json(result[0])
    }) 
})// 해당 유저가 게시한 일반 포스트 개수 리턴
//[{"count(*)": 2}]

app.get('/user-nft-post-num', (req,res) => {
    const {user_code} = req.query
    let query = "select count(*)'count' from post where post_owner=(select user_nickname from user where user_code=?) and post_nft=1;"
    let params = [user_code]
    connection.query(query,params,function(err, result, fields){
        if (err) console.log(err)
        else res.json(result[0])
    }) 
})// 해당 유저가 게시한 nft 포스트 개수 리턴
//아래와 같음

app.get('/user-normal-post-num', (req,res) => {
    const {user_code} = req.query
    let query = "select count(*)'count' from post where post_owner=(select user_nickname from user where user_code=?) and post_nft=0;"
    let params = [user_code]
    connection.query(query,params,function(err, result, fields){
        if (err) console.log(err)
        else res.json(result[0])
    }) 
})// 해당 유저가 게시한 일반 포스트 개수 리턴
//[{"count": 2}]

app.get('/user-all-post', (req,res) => {
    const {user_code,page} = req.query
    let resmsg
    let query = "select * from post where post_owner in (select user_nickname from user where user_code=?) order by post_id desc limit 10 offset ?;"
    let params = [user_code,parseInt(page)*10]
    connection.query(query,params,function(err, result, fields){
        if (err) console.log(err)
        else {
            resmsg = result
            for (let i =0; i<resmsg.length; i++) {
                resmsg[i] = {post: {id: resmsg[i].post_id, owner: resmsg[i].post_owner, like_count: resmsg[i].post_liked,
                                nft: resmsg[i].post_nft, img: resmsg[i].post_img, text: resmsg[i].post_text,
                                title: resmsg[i]. post_title, tag: resmsg[i].post_tag, I_like_this_feed: 0}}
            }
            res.json(resmsg)
        }
    }) 
})// 해당 유저가 게시한 포스트 전부 리턴
//아래와 같음

app.get('/user-nft-post', (req,res) => {
    const {user_code,page} = req.query
    let resmsg
    let query = "select * from post where post_owner in (select user_nickname from user where user_code=?) and post_nft=1 order by post_id desc limit 10 offset ?;"
    let params = [user_code,parseInt(page)]
    connection.query(query,params,function(err, result, fields){
        if (err) console.log(err)
        else {
            resmsg = result
            for (let i =0; i<resmsg.length; i++) {
                resmsg[i] = {post: {id: resmsg[i].post_id, owner: resmsg[i].post_owner, like_count: resmsg[i].post_liked,
                                nft: resmsg[i].post_nft, img: resmsg[i].post_img, text: resmsg[i].post_text,
                                title: resmsg[i]. post_title, tag: resmsg[i].post_tag, I_like_this_feed: 0}}
            }
            res.json(resmsg)
        }
    }) 
})// 해당 유저가 게시한 nft 포스트 전부 리턴
//아래와 같음

app.get('/user-normal-post', (req,res) => {
    const {user_code,page} = req.query
    let resmsg
    let query = "select * from post where post_owner in (select user_nickname from user where user_code=?) and post_nft=0 order by post_id desc limit 10 offset ?;"
    let params = [user_code,parseInt(page)]
    connection.query(query,params,function(err, result, fields){
        if (err) console.log(err)
        else {
            resmsg = result
            for (let i =0; i<resmsg.length; i++) {
                resmsg[i] = {post: {id: resmsg[i].post_id, owner: resmsg[i].post_owner, like_count: resmsg[i].post_liked,
                                nft: resmsg[i].post_nft, img: resmsg[i].post_img, text: resmsg[i].post_text,
                                title: resmsg[i]. post_title, tag: resmsg[i].post_tag, I_like_this_feed: 0}}
            }
            res.json(resmsg)
        }
    }) 
})// 해당 유저가 게시한 nft가 아닌 포스트 전부 리턴
// [
//     {
//         "post_id": 1,
//         "post_owner": "나희도",
//         "post_liked": 2,
//         "post_nft": 0,
//         "post_img": "noimage",
//         "post_text": "notext",
//         "post_tag": null
//     },
//     {
//         "post_id": 4,
//         "post_owner": "나희도",
//         "post_liked": 0,
//         "post_nft": 0,
//         "post_img": "no-image",
//         "post_text": "no-text",
//         "post_tag": null
//     }
// ]
app.get('/duplicate-nickname', (req,res) => {
    const {user_nickname} = req.query
    let query = "select user_code from user where user_nickname = ?;"
    let params = [user_nickname]
    connection.query(query,params,function(err, result, fields){
        if(result.length != 0) {
            console.log('nickname: '+ user_nickname + ' is duplicate!')
            res.json({status_code: 401, message: 'nickname: '+ user_nickname + ' is duplicate!'})
        }
        else res.json({status_code: 200, message: 'nickname: '+ user_nickname + ' is not duplicate!'})
    }) 
}) //닉네임이 중복인지 -> 리턴값은 user_code 해당 유저가 존재하면 user_code를 반환
//중복: [{"user_code": 1}]
//중복x: []

app.get('/user-is-friend', (req,res) => {
    const {user_code, friend_code} = req.query
    let query = "select count(friend_code)'count' from friend where user_code=? and friend_code=?;"
    let params = [user_code, friend_code]
    connection.query(query,params,function(err, result, fields){
        if (err) console.log(err)
        else {
            if(result[0].count != 0) res.json({status_code: 200, message: 'this user is your friend'})
            else res.json({status_code: 200, message: 'this user is not your friend'})
        }
    }) 
}) //user_code - Frined_code로 친구인지 검색 -> 리턴값은 1 or 0 

app.get('/user-all-friends', (req,res) => {    
    const {user_code,page} = req.query
    let query = "select user_code, user_profile, user_nickname, user_desc from user where user_code in (select friend_code from friend where user_code=?) limit 10 offset ?"
    let param = [user_code,parseInt(page)*10]
    let resmsg
    connection.query(query,param,function(err, result, fields) {
        if (err) console.log(err)
        else {
            query = "select distinct reported from (select user_code from user where user_code in (select friend_code from friend where user_code=?) limit 10 offset ?) as tmp, reportuser where tmp.user_code = reportuser.reported"
            param = [user_code,parseInt(page)*10]
            resmsg=result
            connection.query(query,param,function(err, result, fields) {
                for(let i=0; i<resmsg.length;i++) {
                    resmsg[i] = {user_code: resmsg[i].user_code, user_nickname: resmsg[i].user_nickname,
                        user_profile: resmsg[i].user_profile, user_desc: resmsg[i].user_desc,
                        I_report_this_user: 0}
                }
                if (err) console.log(err)
                else {
                    for (let i=0; i<resmsg.length;i++) {
                        for(let j=0;j<result.length;j++) {
                            if(resmsg[i].user_code == result[j].reported){
                                resmsg[i].I_report_this_user = 1
                            }
                        }
                    }
                    res.json(resmsg)
                }
            })
        }
    })
}) //user_code로 모든 친구 닉네임 목록 가져오기
//[{"user_nickname": "백이진"},{"user_nickname":"고유림"}]

app.post('/friend',(req,res) => {
    const {user_code, friend_code} = req.body
    let query = "select count(*)'count' from friend where user_code=? and friend_code=?;"
    let param = [user_code,friend_code]
    connection.query(query,param,function(err,rows,fields){
        if (err) {
            res.json({status_code: 401, message: err})
        }
        else {
            if (rows[0].count ==0){ //친구가 아니면
                query = 'insert into friend (user_code,friend_code) values (?,?);'
                param = [user_code,friend_code]
                connection.query(query,param,function(err,rows,fields){
                    if (err) {
                        res.json({status_code: 401, message: err})
                    }
                    else {
                        console.log('친구추가 잘 됨')
                        res.json({status_code: 200, message: '친구추가 완료'})
                    }
                })
            }
            else {
                query = 'delete from friend where user_code=? and friend_code=?;'
                param = [user_code,friend_code]
                connection.query(query,param,function(err,rows,fields){
                    if (err) {
                        res.json({status_code: 401, message: err})
                    }
                    else {
                        console.log('친구삭제 잘 됨')
                        res.json({status_code: 200, message: '친구삭제 완료'})
                    }
                })
            }
        }
    })
})//친구 추가 -> 단방향(인스타 팔로우)
//x-www-form-urlencoded 형식으로 데이터 전송했음. (post-man기준)

app.delete('/delete-friend',(req,res) => {
    const {user_code, friend_code} = req.query
    let query = 'delete from friend where user_code = ? and friend_code=?;'
    let param = [user_code,friend_code]
    connection.query(query,param,function(err,rows,fields){
        if (err) {
            res.json({status_code: 401, message: err})
        }
        else{
            console.log('친구삭제 잘 됨')
            res.json({status_code: 200, message: '친구삭제 완료'})
        }
    })
})//친구 삭제

app.put('/modify-user-nickname', (req,res) => {
    const {user_code, user_nickname} = req.body
    let query = "update user set user_nickname=? where user_code=?;"
    let params = [user_nickname,user_code]
    connection.query(query,params,function(err, result, fields){
        if (err) {
            res.json({status_code: 401, message: err})
        }
        else{
            res.json({status_code: 200, message: '닉네임 수정 완료'})
            console.log('닉네임 수정 완료!')
        }
    }) 
}) //회원정보 수정(닉네임)



app.post('/regist-user',(req,res) => {
    const {user_nickname, user_wallet} = req.body
    let query = "select user_code from user where user_nickname = ?;"
    let params = [user_nickname]
    connection.query(query,params,function(err, result, fields){
        if(result.length != 0) {
            console.log('nickname: '+ user_nickname + ' is duplicate!')
            res.json({status_code: 401, message: 'nickname: '+ user_nickname + ' is duplicate!'})
        }
        else {
            let query = "select user_code from user where user_wallet = ?;"
            let params = [user_wallet]
            connection.query(query,params,function(err, results, fields){
                if (err) console.log(err)
                if(results.length != 0) {
                    console.log('wallet: '+user_wallet+ ' is duplicate!')
                    res.json({status_code: 401, message: 'wallet: '+user_wallet+ ' is duplicate!'})
                }
                else{
                    let query = 'insert into user (user_nickname,user_wallet,user_profile) values (?,?,?);'
                    let default_profile = 'https://noa-profile.s3.ap-northeast-2.amazonaws.com/profile/default-profile.png'
                    let param = [user_nickname,user_wallet,default_profile]
                    connection.query(query,param,function(err,rows,fields){
                        if (err) {
                            res.json({status_code: 401, message: err})
                        }
                        console.log('회원가입 잘 됨')
                        res.json({status_code: 200, message: '회원가입 완료'})
                    })
                }
            }) 
        }   
    })     
})//회원 가입

app.delete('/withdraw',(req,res) => {
    const {user_code} = req.body    
    let query = 'delete from friend where user_code=? or friend_code=?;'
    let param = [user_code,user_code]
    connection.query(query,param,function(err,rows,fields){
        if (err) {
            res.json({status_code: 401, message: err})
        }
        else{
            console.log('회원 친구 삭제 잘 됨')
            query = 'delete from post where post_owner=(select user_nickname from user where user_code = ?);'
            param = [user_code]
            connection.query(query,param,function(err,rows,fields){
                if (err) {
                    res.json({status_code: 401, message: err})
                }
                else{
                    console.log('회원 포스트 삭제 잘 됨')
                    query = 'delete from nftimage where owner=(select user_nickname from user where user_code=?);'
                    param = [user_code]
                    connection.query(query,param,function(err,rows,fields){
                        if (err) {
                            res.json({status_code: 401, message: err})
                        }
                        else{
                            console.log('회원 지갑 삭제 잘 됨')
                            query = 'delete from user where user_code=?;'
                            param = [user_code]
                            connection.query(query,param,function(err,rows,fields){
                                if (err) {
                                    res.json({status_code: 401, message: err})
                                }
                                console.log('회원정보 삭제 잘 됨')
                                res.json({status_code: 200, message: '회원정보 삭제 완료'})
                            })
                        }
                    })
                }
            })
        }
    }) 
})//회원 탈퇴 - 회원정보 삭제(친구,포스트,지갑, 유저정보)

app.delete('/withdraw-chatting',(req,res) => {
    
})//회원 탈퇴 4 - 회원 채팅 삭제 는 보류. 채팅방 남겨놔야 할것 같음.


app.get('/search-by-nickname', (req,res) => {
    const {word} = req.query
    let query = "select user_nickname from user where user_nickname like ?;"
    let params = ['%'+word+'%']
    connection.query(query,params,function(err, result, fields){
        if (err) console.log(err)
        else res.json(result)
    }) 
}) //회원 닉네임 검색 (닉네임 중 일부만 쳐도 해당 단어가 들어간 닉네임 검색)
// [{ "user_nickname": "yeejin"}, {"user_nickname":"yurim"}]

app.get('/search-by-post-tag', (req,res) => {
    const {word} = req.query
    let query = "select post_id from post where post_tag like ?;"
    let params = ['%'+word+'%']
    connection.query(query,params,function(err, result, fields){
        if (err) console.log(err)
        else res.json(result)
    }) 
}) //포스트 태그 검색 (태그 중 일부만 쳐도 해당 단어가 들어간 태그 검색)

app.get('/search-by-title-content', (req,res) => {
    const {word} = req.query
    let query = "select post_id,post_title from post where post_title like ? or post_text like ?;"
    let params = ['%'+word+'%','%'+word+'%']
    connection.query(query,params,function(err, result, fields){
        if (err) console.log(err)
        else res.json(result)
    }) 
}) //제목+내용으로 검색 (태그 중 일부만 쳐도 해당 단어가 들어간 post 검색)

app.get('/search-result', (req,res) => {
    let search_result
    // r ={post_id:0, 
    //     owner:{nickname:'',user_id:0,profile:''},
    //     post:{post_title:'',post_img:'',post_text:'',
    //          post_liked:0, post_nft:0, post_tag:''}}
    const {user_code,word,page} = req.query
    let query = "select post_id, post_owner, post_liked, post_nft, post_title, post_img, post_text, post_tag from post where post_id in (select post_id from post where post_title like ? or post_text like ?) order by post_id desc limit 10 offset ?;"
    let params = ['%'+word+'%','%'+word+'%',parseInt(page)*10]
    connection.query(query,params,function(err, result, fields){
        if (err) console.log(err)
        else {
            search_result = result
            //console.log('before:',search_result)
            for(let i=0;i < search_result.length; i++) {
                search_result[i] = {
                    user:{nickname:search_result[i].post_owner,user_code:0,profile:''},
                    post:{id: search_result[i].post_id, like_count:search_result[i].post_liked,nft:search_result[i].post_nft,img:search_result[i].post_img,
                         text:search_result[i].post_text, title:search_result[i].post_title, tag:search_result[i].post_tag,
                         I_like_this_feed:0, I_report_this_feed:0}}
            }
            query = "select user_code, user_nickname, user_profile from user,post where user.user_nickname=post.post_owner and post_id in (select post_id from post where post_title like ? or post_text like ?) order by post_id desc limit 10 offset ?;"
            params = ['%'+word+'%','%'+word+'%',parseInt(page)*10]
            connection.query(query,params,function(err, result, fields){
                if (err) console.log(err)
                else {
                    //console.log(result)
                    //console.log(search_result)
                    for(let i=0;i < search_result.length; i++) {
                        for (let j=0;j<result.length;j++) {
                            if(search_result[i].user.nickname == result[j].user_nickname) {
                                search_result[i].user.user_code = result[j].user_code
                                search_result[i].user.profile = result[j].user_profile
                            }
                        }                       
                    }
                    //console.log('after: ',search_result)
                    query = "select post_id from (select post_id, post_owner, post_liked, post_nft, post_title, post_img, post_text, post_tag from post where post_id in (select post_id from post where post_title like ? or post_text like ?) order by post_id desc limit 10 offset ?) as tmp, postlike where tmp.post_id = postlike.post and postlike.user=?;"
                    params = ['%'+word+'%','%'+word+'%',parseInt(page)*10,user_code]
                    connection.query(query,params,function(err, result, fields){
                        if (err) console.log(err)
                        else {
                            //console.log(resultss)
                            for(let i=0;i<search_result.length;i++) {
                                for (let j=0;j<result.length;j++) {
                                    if(result[j].post_id == search_result[i].post_id) {
                                        search_result[i].post.I_like_this_feed = 1
                                    }                            
                                }
                            }
                            query = "select reportpost.post_id from (select post_id, post_owner, post_liked, post_nft, post_title, post_img, post_text, post_tag from post where post_id in (select post_id from post where post_title like ? or post_text like ?) order by post_id desc limit 10 offset ?) as tmp, reportpost where tmp.post_id = reportpost.post_id and reportpost.user_code=?;"
                            params = ['%'+word+'%','%'+word+'%',parseInt(page)*10,user_code]
                            connection.query(query,params,function(err, resultss, fields){
                                if (err) console.log(err)
                                else {
                                    //console.log(resultss)
                                    for(let i=0;i<search_result.length;i++) {
                                        for (let j=0;j<resultss.length;j++) {
                                            if(resultss[j].post_id == search_result[i].post_id) {
                                                search_result[i].post.I_report_this_feed = 1
                                            }                            
                                        }
                                    }
                                    res.json(search_result)
                                }
                            })
                        }
                    })
                    //res.json(search_result)
                }
            }) 
        }
    }) 
}) //제목+내용으로 검색 (태그 중 일부만 쳐도 해당 단어가 들어간 post 검색)


app.get('/home-post', (req,res) => {
    let resmsg
    const {user_code,page} = req.query
    let query = "select user_code, user_nickname, user_profile, post_id, post_owner, post_liked, post_nft, post_img, post_text,post_title, post_tag from post,user where post_owner = user_nickname and post_owner in (select distinct user_nickname from user where user_code in (select friend_code from friend where user_code=?)) order by post_id desc limit 10 offset ?;"
    let params = [user_code,parseInt(page)*10]
    connection.query(query,params,function(err, result, fields){
        if (err) console.log(err)
        else {
            resmsg = result
            for(let i=0;i<resmsg.length;i++) {
                resmsg[i] = {user: {user_code: resmsg[i].user_code, nickname: resmsg[i].user_nickname, profile:resmsg[i].user_profile}, 
                    post: {id: resmsg[i].post_id, like_count: resmsg[i].post_liked,
                            nft: resmsg[i].post_nft, img: resmsg[i].post_img, text: resmsg[i].post_text,
                            title: resmsg[i]. post_title, tag: resmsg[i].post_tag, I_like_this_feed: 0, I_report_this_feed: 0}}
            }
            query = "select post_id from (select post_id from post,user where post_owner = user_nickname and post_owner in (select distinct user_nickname from user where user_code in (select friend_code from friend where user_code=?)) order by post_id desc limit 10 offset ?) as tmp, postlike where tmp.post_id = postlike.post and postlike.user=?;"
            params = [user_code,parseInt(page)*10,user_code]
            connection.query(query,params,function(err, results, fields){
                if (err) console.log(err)
                else {
                    for(let i=0;i<resmsg.length;i++) {
                        for (let j=0;j<results.length;j++) {
                            if(results[j].post_id == resmsg[i].post.id) {
                                resmsg[i].post.I_like_this_feed = 1
                            }                            
                        }
                    }
                    query = "select reportpost.post_id from (select post_id from post,user where post_owner = user_nickname and post_owner in (select distinct user_nickname from user where user_code in (select friend_code from friend where user_code=?)) order by post_id desc limit 10 offset ?) as tmp, reportpost where tmp.post_id = reportpost.post_id and reportpost.user_code=?;"
                    params = [user_code,parseInt(page)*10,user_code]
                    connection.query(query,params,function(err, results, fields){
                        if (err) console.log(err)
                        else {
                            for(let i=0;i<resmsg.length;i++) {
                                for (let j=0;j<results.length;j++) {
                                    if(results[j].post_id == resmsg[i].post.id) {
                                        resmsg[i].post.I_report_this_feed = 1
                                    }                            
                                }
                            }
                            res.json(resmsg)
                        }
                    })
                }
            })
        }
    })
})
//홈 화면.

app.get('/random-post', (req,res) => {
    let resmsg
    let random_num = Math.floor(Math.random()*1000)
    //console.log('random: ',random_num)
    const {user_code,page} = req.query
    let query = "select user_code, user_nickname, user_profile, post_id, post_owner, post_liked, post_nft, post_img, post_text, post_title, post_tag from post,user where post_owner = user_nickname and post_owner not in (select user_nickname from user where user_code=?) order by RAND(?) limit 10 offset ?;"
    let params = [user_code,random_num,parseInt(page)*10]
    //console.log('1 param: ', params)
    connection.query(query,params,function(err, result, fields){
        if (err) console.log(err)
        else {
            resmsg = result
            for(let i=0;i<resmsg.length;i++) {
                resmsg[i] = {user: {user_code: resmsg[i].user_code, nickname: resmsg[i].user_nickname, profile:resmsg[i].user_profile}, 
                    post: {id: resmsg[i].post_id, like_count: resmsg[i].post_liked,
                            nft: resmsg[i].post_nft, img: resmsg[i].post_img, text: resmsg[i].post_text,
                            title: resmsg[i]. post_title, tag: resmsg[i].post_tag, I_like_this_feed: 0, I_report_this_feed: 0}}
            }
            //query = "select post_id from (select post_id from post,user where post_owner = user_nickname and post_owner not in (select user_nickname from user where user_code=?) order by RAND(?) limit 10 offset ?) as tmp, postlike where tmp.post_id = postlike.post and postlike.user=?;"
            query = "select post_id from (select post_id from post where post_id in(?)) as tmp, postlike where tmp.post_id = postlike.post and postlike.user=?;"
            //params = [user_code,random_num,parseInt(page)*10,user_code]
            let tmp = []
            for(let i=0;i<resmsg.length;i++){
                tmp.push(resmsg[i].post.id)
            }
            //console.log('tmp: ',tmp)
            //console.log('2 params: ',params)
            let tmp1 = [user_code]
            let arr = [tmp,tmp1]
            if(tmp.length>0) {
                connection.query(query,arr,function(err, result, fields){
                    if (err) console.log(err)
                    else {
                        //console.log('2 p i : ', result)
                        for(let i=0;i<resmsg.length;i++) {
                            for (let j=0;j<result.length;j++) {
                                if(result[j].post_id == resmsg[i].post.id) {
                                    resmsg[i].post.I_like_this_feed = 1
                                }                            
                            }
                        }
                        query = "select reportpost.post_id from (select post_id from post where post_id in(?)) as tmp, reportpost where tmp.post_id = reportpost.post_id and reportpost.user_code=?;"
                        connection.query(query,arr,function(err, result, fields){
                            if (err) console.log(err)
                            else {
                                for(let i=0;i<resmsg.length;i++) {
                                    for (let j=0;j<result.length;j++) {
                                        if(result[j].post_id == resmsg[i].post.id) {
                                            resmsg[i].post.I_report_this_feed = 1
                                        }                            
                                    }
                                }
                                res.json(resmsg)
                            }
                        })
                    }
                })
            }
            else{
                res.json(resmsg)
            }
        }
    })
})
//랜덤 피드 화면. 중복 문제가 있음.

app.put('/report-user', (req,res) => {
    const {user_code, reported_user} = req.body
    let query = "select count(*)'count' from reportuser where user_code = ? and reported = ?;"
    let params = [user_code, reported_user]
    connection.query(query,params,function(err, result, fields){
        if (err) {
            res.json({status_code: 401, message: err})
        }
        else{
            if(user_code == reported_user) res.json({status_code: 401, message: '자기 자신은 신고할 수 없음.'})
            //console.log('count:',result[0].count)
            else{
                if(result[0].count == 0) {
                    query = "update user set user_report = user_report+1 where user_code=?;"
                    params = [reported_user]
                    connection.query(query,params,function(err, result, fields){
                        if (err) {
                            res.json({status_code: 401, message: err})
                        }
                        else{
                            query = "insert into reportuser (user_code, reported) values (?,?);"
                            params = [user_code,reported_user]
                            connection.query(query,params,function(err, result, fields){
                                if (err) {
                                    res.json({status_code: 401, message: err})
                                }
                                else{
                                    res.json({status_code: 200, message: '유저 신고 완료!'})
                                    console.log('유저 신고 완료!')
                                }
                            })
                        }
                    })
                }
                else {
                    query = "update user set user_report = user_report-1 where user_code=?;"
                    params = [reported_user]
                    connection.query(query,params,function(err, result, fields){
                        if (err) {
                            res.json({status_code: 401, message: err})
                        }
                        else{
                            query = "delete from reportuser where user_code = ? and reported = ?;"
                            params = [user_code, reported_user]
                            connection.query(query,params,function(err, result, fields){
                                if (err) {
                                    res.json({status_code: 401, message: err})
                                }
                                else{                                
                                    res.json({status_code: 200, message: '유저 신고 취소'})
                                    console.log('유저 신고 취소')
                                }
                            })                        
                        }
                    })

                }
            }
        }    
    }) 
})//유저 신고하기

app.put('/report-post', (req,res) => {
    const {user_code, reported_post} = req.body
    let query = "select user_code from user,post where user_nickname=post_owner and post_id=?;"
    let params = [reported_post]
    connection.query(query,params,function(err, result, fields){
        if (err) {
            res.json({status_code: 401, message: err})
        }
        else{                                
            if(result[0].user_code == user_code) res.json({status_code: 401, message: '자신의 피드는 신고할 수 없음.'})
            else{
                query = "select count(*)'count' from reportpost where user_code = ? and post_id = ?;"
                params = [user_code, reported_post]
                connection.query(query,params,function(err, result, fields){
                    if (err) {
                        res.json({status_code: 401, message: err})
                    }
                    else{
                        //console.log('count:',result[0].count)
                        if(result[0].count == 0) {
                            query = "update post set post_report = post_report+1 where post_id=?;"
                            params = [reported_post]
                            connection.query(query,params,function(err, result, fields){
                                if (err) {
                                    res.json({status_code: 401, message: err})
                                }
                                else{
                                    query = "insert into reportpost (user_code, post_id) values (?,?);"
                                    params = [user_code,reported_post]
                                    connection.query(query,params,function(err, result, fields){
                                        if (err) {
                                            res.json({status_code: 401, message: err})
                                        }
                                        else{
                                            res.json({status_code: 200, message: '피드 신고 완료!'})
                                            console.log('피드 신고 완료!')
                                        }
                                    })
                                }
                            })
                        }
                        else {
                            query = "update post set post_report = post_report-1 where post_id=?;"
                            params = [reported_post]
                            connection.query(query,params,function(err, result, fields){
                                if (err) {
                                    res.json({status_code: 401, message: err})
                                }
                                else{
                                    query = "delete from reportpost where user_code=? and post_id=?;"
                                    params = [user_code, reported_post]
                                    connection.query(query,params,function(err, result, fields){
                                        if (err) {
                                            res.json({status_code: 401, message: err})
                                        }
                                        else{                                
                                            res.json({status_code: 200, message: '피드 신고 취소'})
                                            console.log('피드 신고 취소')
                                        }
                                    })                        
                                }
                            })
            
                        }
                    }    
                })
            }
        }
    }) 
     
})//포스팅 신고하기

//chatting

// const chat = io.of('/chat')

// const MAXLISTENS = 0;

// chat.setMaxListeners(MAXLISTENS);
// const room_id = 1

// chat.on('connection', socket =>{
//     console.log('connected.')


//     socket.on('disconnect', (data) =>{
//         console.log('disconnected.')
//     })

//     socket.on('joinRoom', data => {
//         socket.join(data.user_code)
//     })

//     socket.on('closeChat', data => {
//         socket.leave(data.user_code)
//         console.log(data.user_code+' is left.')
//     })

//     socket.on('chatting', data => {
//         (async () => {
//             try {
//                 await io.to(data.user_code).emit('message',data)
//             } catch (error) {
//                 console.log(error)
//             }
//         })
//     })
//     socket.on('leaveRoom',data => {
//         io.broadcast.to(data.user_code).emit('leftuser',data)
//     })
// })

io.on("connection",(socket) => { 
    console.log('connected.')
    socket.on("join",(data) => {  
        //console.log(data)
        const room = data.room_id// room_id 를 emit으로 넘겨받음.
        
        socket.join(room) //**까지 삭제시 사용
        let query = "select * from chatting where room_id=? order by msg_num desc limit 10 offset 0;"
        let params = [room]
        connection.query(query,params,function(err, result, fields){
            if (err) console.log(err)
            else {
                socket.emit('msg', result)
                console.log('msg')
            }
        }) 
    })
    socket.on("chatting",(data)=> {
//         let msg_time = moment(new Date()).format("YYYY-MM-DD hh:mm:ss")
        const {room_id,msg_to, msg_from, msg_content, msg_time} = data;        
        let query = 'insert into chatting (room_id,Msg_to,Msg_from,Msg_content,Created,Read_state) values (?,?,?,?,?,1);'
        let param = [parseInt(room_id),msg_to,msg_from,msg_content,msg_time,1]
        connection.query(query,param,function(err,rows,fields){
            if(err) console.log(err)
            else console.log('Msg DB에 잘 입력됨')
        })
        //채팅 DB에 입력
        socket.to(room_id).emit("chatting", {
            msg_to,
            msg_from,
            msg_content,
            msg_time,
        })
        //채팅 client에 emit
        //await pushMessage(room,msg_to,partner_code,msg_content)

        //채팅 알림 기능

    })
    // socket.on("leave",(data) => {
    //     const { room_id } = data;
    //     socket.leave(room_id);
    // })
})

server.listen(PORT, ()=>console.log(`server is running ${PORT}`))
