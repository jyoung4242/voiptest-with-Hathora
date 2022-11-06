import { HathoraClient, HathoraConnection, UpdateArgs } from "../../.hathora/client";
import "./style.css";
import { MediaConnection, Peer } from "peerjs";
import { UI } from "peasy-ui";
import { callType, HathoraEventTypes, IInitializeRequest } from "../../../api/types";
import { AnonymousUserData } from "../../../api/base";

type userArray = {
  id: number;
  isCallActive: boolean;
  isVisible: boolean;
};

const myClient: HathoraClient = new HathoraClient();
let myConnection: HathoraConnection;
let myPeer: any;
let user: AnonymousUserData;
//let localUIuser: userArray[];
let callData: any;
/**
 * STATE -> this is where UI bound data and methods are kept
 * see Peasy-UI documentation
 */
let state = {
  //properties
  users: <any>[],
  localUIuser: <any>[],
  name: "NAME",
  peerID: "",
  roomID: "",
  token: "",
  myIndex: 0,
  isLoginDisabled: false,
  isCreateDisabled: true,
  isConnectDisabled: true,
  isJoinDisabled: true,
  isRoomIdDisabled: true,
  //modal object
  modal: {
    isVisible: false,
    from: "",
    answer: () => {
      answer(callData);
    },
    decline: () => {
      callData.close();
      state.modal.isVisible = false;
    },
  },
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
          state.isCreateDisabled = false;
          state.isLoginDisabled = true;
          state.isRoomIdDisabled = false;
        })
        .catch(error => {
          console.log(error);
        });
    } else {
      state.token = sessionStorage.getItem("token");
      console.log("token found: ", state.token);
      user = await HathoraClient.getUserFromToken(state.token);
      console.log("user ID: ", user);
      state.isCreateDisabled = false;
      state.isLoginDisabled = true;
      state.isRoomIdDisabled = false;
    }
  },
  join: async () => {
    await myConnection.joinGame({ name: state.name });
    state.isJoinDisabled = true;
    console.log("joining, ", user.id);
    await myConnection.setPeerID({ id: state.peerID });
  },
  connect: () => {
    if (state.roomID != "") {
      myClient
        .connect(state.token, state.roomID, updateArgs, onError)
        .then(cnction => {
          myConnection = cnction;
          console.log("connection: ", myConnection);

          state.isConnectDisabled = true;
          state.isCreateDisabled = true;

          myPeer = new Peer();
          myPeer.on("open", async (id: any) => {
            console.log("peer ID: ", id);
            state.peerID = id;

            state.isJoinDisabled = false;
          });

          myPeer.on("call", async (call: any) => {
            console.log("getting called");
            callData = call;
            showModal(call);
          });
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
        state.isConnectDisabled = false;
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
    console.log("trg/src", target, source);

    const remoteID = object.$parent.$model.users[target].peerID;
    console.log("remote: ", remoteID);
    if (target == source) return;
    if (remoteID == undefined) return;

    console.log("calling: ", remoteID);
    //call(remoteID, target, source, true);
    myConnection.mkCall({ to: target, from: source, type: callType.Video });
  },
  updateRoomID: () => {
    if (state.roomID != "" && state.isLoginDisabled == true) state.isConnectDisabled = false;
  },
};

/**
 *check if browser will give us ACCESS
 *to microphone and camera
 */
if ("mediaDevices" in navigator && "getUserMedia" in navigator.mediaDevices) {
  console.log("Let's get this party started");
} else {
  window.alert("BROWSER NO WORKY");
  console.error("Browser not giving access to camera/microphone");
}

/**
 * String literal that defines the html
 * to be injected into the DOM with
 * data bindings
 */
let template = `
    <div>
        <div class="section">
            <button \${click@=>login} \${disabled <== isLoginDisabled} >Login</button>
            <button \${click@=>create} \${disabled <== isCreateDisabled} >Create Game</button>
            <label>Player Name</label><input type="text" \${value<=>name}>
            
        </div>
        <div class="section">
            <label>Room ID</label><input type="text" \${disabled <== isRoomIdDisabled} \${input@=>updateRoomID} \${value<=>roomID}>
            <button \${click@=>connect} \${disabled <== isConnectDisabled}>Connect</button>
            <button \${click@=>join} \${disabled <== isJoinDisabled} >Enter Game</button>
        </div>

        <div class="section">
            <p>Peer ID is: \${peerID}</p>
        </div>

        <div class="modal" \${===modal.isVisible}>
           <div class="modal_outer"></div>
           <div class="modal_inner">
              <p> Call from \${modal.from}...</p>
              <p> Would you like to accept call?</p>
              <div class="modal_buttons">
                  <button class="modal_button" \${click@=>modal.answer}>Answer</button>
                  <button class="modal_button" \${click@=>modal.decline}>Decline</button>
              </div>
           </div>
        </div>

        <div class="section vidContainer">
          <div class="user" \${user<=*localUIuser:id}>
            <div class="buttondiv" \${===user.isVisible}>
              <button id="AC_\${user.id}" \${!==user.isCallActive} \${click@=>makeAudioCall}>Audio</button>
              <button id="VC_\${user.id}"\${!==user.isCallActive} \${click@=>makeCall}>Video</button>       
              <button id="Mute_\${user.id}" \${===user.isCallActive} \${click@=>mute}>Mute</button> 
              <button id="CC_\${user.id}" \${===user.isCallActive} \${click@=>disconnect}>Close</button> 
            </div>
            <div class="zoomcrop" style="border: 1px solid white;" >
              <video id="myvid\${user.id}"></video>
            </div>
          </div>
        </div>
    </div>
`;

/**
 * Peasy methods for setting up the UI
 * data iteration and injection into the DOM
 */
UI.create(document.body, template, state);
setInterval(() => {
  UI.update();
}, 1000 / 60);

/**
 * HATHORA METHODS
 * updateArgs, this runs whenever the server sends
 * data updates to each client, includes 'events'
 *
 * onError, this is ran when Server sends error data
 */
const updateArgs = (update: UpdateArgs) => {
  console.log("STATE UPDATES:", update);
  state.users = update.state.Players;
  state.myIndex = update.state.Players.findIndex(u => {
    return u.playerID == user.id;
  });
  state.users.forEach((user: any, index: number) => {
    console.log("looping");
    if (!state.localUIuser[user.index]) {
      console.log("in loop");
      state.localUIuser[user.index] = { id: user.index, isCallActive: false, isVisible: false };
      if (state.myIndex != index) state.localUIuser[user.index].isVisible = true;
    }
    // state.myIndex == index ? (user.isVisible = false) : (user.isVisible = true);
  });

  if (update.events.length) {
    console.log("EVENTS: ", update.events);
    update.events.forEach(event => {
      if (event.type == HathoraEventTypes.default) {
        const { fromIndex } = event.val;
        if (fromIndex != state.myIndex) {
          state.modal.from = state.users[fromIndex].name;
        } else {
          call(event.val.toID, event.val.toIndex, event.val.fromIndex, true);
        }
      }
    });
  }
  console.log("state: ", state);
};
const onError = (errorMessage: any) => {
  console.log(errorMessage);
};

/**
 * User Defined Methods
 *
 * call, this uses PeerJS to make a voip call
 */
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
      console.log(srcCntrl);
      console.log("stream established");
      console.log(remoteStream);
      const vidCntrl: any = document.getElementById(`myvid${trg}`);
      vidCntrl.srcObject = remoteStream;
      vidCntrl.play();
      console.log(vidCntrl);
      state.localUIuser[trg].isCallActive = true;
      state.localUIuser[trg].isVisible = false;
      state.localUIuser[src].isCallActive = true;
      state.localUIuser[src].isVisible = true;
    });
  } catch (error) {
    window.alert(error);
  }
};

const answer = async (call: MediaConnection) => {
  const src = state.myIndex;
  const callerID = call.peer;
  const callerIndex = state.users.findIndex((u: any) => {
    return u.peerID == callerID;
  });
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
      console.log(srcCntrl);
      console.log("stream established");
      console.log(remoteStream);
      const vidCntrl: any = document.getElementById(`myvid${callerIndex}`);
      vidCntrl.srcObject = remoteStream;
      vidCntrl.play();
      console.log(vidCntrl);
      state.localUIuser[callerIndex].isCallActive = true;
      state.localUIuser[callerIndex].isVisible = false;
      state.localUIuser[src].isCallActive = true;
      state.localUIuser[src].isVisible = true;
      state.modal.isVisible = false;
    });
  } catch (error) {
    window.alert(error);
  }
};

const showModal = (call: any) => {
  state.modal.isVisible = true;
};
