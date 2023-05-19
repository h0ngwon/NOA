const express = require("express");
const Web3 = require("web3");
const cors = require("cors");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const app = express();
const port = 3000;
const abi = require("./build/contracts/NoA.json").abi;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

//Test network Web3 객체 생성
const web3 = new Web3(
    new Web3.providers.HttpProvider("https://api.baobab.klaytn.net:8651")
);

//new web3.eth.Contract로 Contract객체 생성 첫번째 파라미터 abi는 Json 객체, 두번째 파라미터는 배포된 지갑 주소
const NoAContract = new web3.eth.Contract(
    abi,
    "0x4B8035af8c66E42879E5AEfacac1DA914F0C5443"
);

app.post("/uploadNFT", upload.single("photo"), (req, res) => {
    //web3.eth.accounts.create() 메서드로 주소와 privateKey를 생성후
    //web3.eth.accounts.privateKeyToAccount(privateKey)로 account를 생성한 후
    //NoAContract.methods.send에 from: 에 account를 넣어주면 됨

    var byte = req.file.size;
    var title = req.body.title;
    var desc = req.body.description;
    var wallet = req.body.wallet;
    var privateKey = req.body.privateKey;
    var userPrivateKey = web3.eth.accounts.privateKeyToAccount(privateKey);
    web3.utils.toChecksumAddress(userPrivateKey);
    console.log(userPrivateKey);
    //NoAContract.method.uploadPhoto를 통해 NFT 민팅 메서드 실행
    //send에 from은 사용자가 만든 지갑의 privateKey를 넣어줘야함으로 privateKey를 가지는 변수를 선언해서
    //값을 가지고 있어야 함
    NoAContract.methods
        .uploadPhoto(byte, title, desc)
        .send({
            from: userPrivateKey,
            gas: "8500000",
            gasPrice: null,
        })
        .catch((error) => {
            console.error(error);
        });
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
