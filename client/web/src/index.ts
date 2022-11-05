import { HathoraClient, HathoraConnection, UpdateArgs } from "../../.hathora/client";
import "./style.css";
import { Peer } from "peerjs";
import { UI } from "peasy-ui";
import { IInitializeRequest } from "../../../api/types";
import { AnonymousUserData } from "../../../api/base";

const myClient: HathoraClient = new HathoraClient();
let myConnection: HathoraConnection;
const myPeer = new Peer();
let user: AnonymousUserData;

let state = {
  //properties
  users: <any>[],
  name: "NAME",
  peerID: "",
  roomID: "",
  token: "",
  myIndex: 0,
  //methods
  login: async () => {
    if (sessionStorage.getItem("token") === null) {
      myClient
        .loginAnonymous()
        .then(tkn => {
          console.log("here");
          state.token = tkn;
          sessionStorage.setItem("token", state.token);
          user = HathoraClient.getUserFromToken(state.token);
          console.log("user ID: ", user);
        })
        .catch(error => {
          console.log(error);
        });
    } else {
      state.token = sessionStorage.getItem("token");
      console.log("token found: ", state.token);
      user = await HathoraClient.getUserFromToken(state.token);
      console.log("user ID: ", user);
    }
  },
  join: () => {
    myConnection.joinGame({ name: state.name });
    console.log("joining, ", user.id);
  },
  connect: () => {
    if (state.roomID != "") {
      myClient
        .connect(state.token, state.roomID, updateArgs, onError)
        .then(cnction => {
          myConnection = cnction;
          console.log("connection: ", myConnection);
        })
        .catch(error => {
          console.log(error);
        });
    }
  },
  create: () => {
    const config: IInitializeRequest = {};

    myClient
      .create(state.token, config)
      .then(rm => {
        state.roomID = rm;
        console.log("room ID: ", state.roomID);
      })
      .catch(error => {
        console.log(error);
      });
  },
  updatePeerID: () => {
    console.log("setting PeerID: ", state.peerID);
    myConnection.setPeerID({ id: state.peerID });
  },
  makeCall: (_event: any, model: any, element: any, _attribute: any, object: any) => {
    const target = parseInt(element.id.split("_")[1]);
    const source = object.$parent.$model.myIndex;
    const remoteID = object.$parent.$model.users[target].peerID;
    console.log(target, source, remoteID);
    if (target == source) return;
    if (remoteID == undefined) return;

    console.log("calling: ", remoteID);
    call(remoteID, target, source, true);
  },
};

//check if browser will give us ACCESS
if ("mediaDevices" in navigator && "getUserMedia" in navigator.mediaDevices) {
  console.log("Let's get this party started");
} else {
  window.alert("BROWSER NO WORKY");
  console.error("Browser not giving access to camera/microphone");
}

myPeer.on("open", id => {
  console.log("peer ID: ", id);
  state.peerID = id;
  console.log(state);
});

let template = `
    <div>
        <div class="section">
            <button \${click@=>login} >Login</button>
            <button \${click@=>create} >Create Game</button>
            <label>Player Name</label><input type="text" \${value<=>name}>
            
        </div>
        <div class="section">
            <label>Room ID</label><input type="text" \${value<=>roomID}>
            <button \${click@=>connect} >Connect</button>
            <button \${click@=>join} >Enter Game</button>
        </div>

        <div class="section">
            <p>Peer ID is: \${peerID}</p>
            <button \${click@=>updatePeerID}>Register PeerID</button>
        </div>

        <div class="section vidContainer">
          <div class="user" \${user<=*users:index}>
            <div class="buttondiv" \${===user.isVisible}>
              <button id="AC_\${user.index}" \${!==user.isCallActive} \${click@=>makeAudioCall}>Audio</button>
              <button id="VC_\${user.index}"\${!==user.isCallActive} \${click@=>makeCall}>Video</button>       
              <button id="Mute_\${user.index}" \${===user.isCallActive} \${click@=>mute}>Mute</button> 
              <button id="CC_\${user.index}" \${===user.isCallActive} \${click@=>disconnect}>Close</button> 
            </div>
            <div class="zoomcrop" style="border: 1px solid white;" >
              <video id="myvid\${user.index}"></video>
            </div>
          </div>
        </div>
    </div>
`;

UI.create(document.body, template, state);
setInterval(() => {
  UI.update();
}, 1000 / 60);

const updateArgs = (update: UpdateArgs) => {
  console.log("STATE UPDATES:", update);
  state.users = update.state.Players;
  state.myIndex = update.state.Players.findIndex(u => {
    return u.playerID == user.id;
  });
  state.users.forEach((user: any, index: number) => {
    state.myIndex == index ? (user.isVisible = false) : (user.isVisible = true);
  });
  console.log(state);
};
const onError = (errorMessage: any) => {
  console.log(errorMessage);
};

myPeer.on("call", async call => {
  console.log("getting called");

  const src = state.myIndex;
  const trg = src + 1;
  let getUserMedia = navigator.mediaDevices.getUserMedia;
  try {
    console.log("trying call");
    let stream = await getUserMedia({ video: true, audio: true });
    console.log("answering call");
    call.answer(stream);
    call.on("stream", (remoteStream: any) => {
      const srcCntrl: any = document.getElementById(`myvid${src}`);
      srcCntrl.srcObject = stream;
      srcCntrl.play();
      console.log("stream established");
      console.log(remoteStream);
      const vidCntrl: any = document.getElementById(`myvid${trg}`);
      vidCntrl.srcObject = remoteStream;
      vidCntrl.play();
      state.users[trg - 1].callActive = true;
      state.users[src - 1].callActive = true;
    });
  } catch (error) {
    window.alert(error);
  }
});

const call = async (remotePeerID: any, trg: number, src: number, video: boolean) => {
  let getUserMedia = navigator.mediaDevices.getUserMedia;
  try {
    console.log("setting up stream");
    let stream = await getUserMedia({ video: video, audio: true });
    console.log("making call");
    const call = myPeer.call(remotePeerID, stream, {});
    console.log("call id: ", call);

    call.on("stream", (remoteStream: any) => {
      const srcCntrl: any = document.getElementById(`myvid${src}`);
      srcCntrl.srcObject = stream;
      srcCntrl.play();
      console.log("stream established");
      console.log(remoteStream);
      const vidCntrl: any = document.getElementById(`myvid${trg}`);
      vidCntrl.srcObject = remoteStream;
      vidCntrl.play();
      state.users[trg - 1].callActive = true;
      state.users[src - 1].callActive = true;
    });
  } catch (error) {
    window.alert(error);
  }
};
