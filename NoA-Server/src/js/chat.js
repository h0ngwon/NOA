"use strict"
const socket = io()
const nickname = document.querySelector("#nickname")
const chatList = document.querySelector(".chatting-list")
const chatInput = document.querySelector(".chatting-input")
const sendButton = document.querySelector(".send-button")
const displayContainer = document.querySelector(".display-container")
const partner = document.querySelector(".msg-to")

var room = prompt('방 이름 입력하세요: ','')
socket.emit("join",{room_id:room})
console.log(room)
function send() {
    const param = {
        msg_to: '나희도',
        msg_from: '백이진',
        msg_content: chatInput.value,
    }
    socket.emit("chatting", param)
    chatInput.value = "";
}
chatInput.addEventListener("keypress",(event) =>{
    if(event.keyCode === 13) {
        send()
    }
})

socket.on('msg', (data) =>{
    console.log('msg: ',data)
})

sendButton.addEventListener("click", send)

// socket.on("room", (data) => {
//     const {msg_to} = data
//     //document.getElementById('msg_to').value=msg_to // label value변경하려 했는데 어떻게 하는지 모름,,
//     console.log('client msg_to: ',msg_to)
// }) 채팅 상대 닉네임이 필요한 경우 사용

socket.on("chatting", (data)=> {
    const {msg_to, msg_from, msg_content, msg_time} = data;
    const item = new LIModel(msg_to, msg_from, msg_content, msg_time);    
    item.makeLi()
    displayContainer.scrollTo(0, displayContainer.scrollHeight)
})
function LIModel(msg_to, msg_from, msg_content, msg_time){
    this.msg_to = msg_to;
    this.msg_from = msg_from;
    this.msg_content = msg_content;
    this.msg_time = msg_time;
    this.makeLi = ()=>{
        const li = document.createElement("li")
        li.classList.add(nickname.value === this.msg_from ? "sent": "received")
        const dom = `<span class="profile">
        <span class="user">${this.msg_from}</span>
        <img class="image" src="https://placeimg.com/50/50/any" alt="any">
        </span>
        <span class="message">${this.msg_content}</span>
        <span class="time">${this.msg_time}</span>`;
        li.innerHTML = dom;
        chatList.appendChild(li);
    }
}