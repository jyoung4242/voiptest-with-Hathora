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
  isMuted: boolean;
};

const myClient: HathoraClient = new HathoraClient();
let myConnection: HathoraConnection;
let myPeer: any;
let user: AnonymousUserData;
let callData: any;
let streams = <any>[null, null, null, null];

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
  isCopyDisabled: true,
  //modal object
  modal: {
    isVisible: false,
    type: callType.Video,
    from: "",
    answer: () => {
      answer(callData, state.modal.type);
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
          if (state.roomID != "") {
            setTimeout(() => {
              state.isConnectDisabled = false;
            }, 500);
          }
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
      if (state.roomID != "") {
        setTimeout(() => {
          state.isConnectDisabled = false;
        }, 500);
      }
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
      if (state.name == "NAME") {
        const nm = document.getElementById("name");
        (nm as HTMLInputElement).focus();
        (nm as HTMLInputElement).select();
        return;
      }
      myClient
        .connect(state.token, state.roomID, updateArgs, onError)
        .then(cnction => {
          state.isCopyDisabled = false;
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

          myPeer.on("disconnected", () => {
            console.log("Call Disconnected");
            //myPeer.reconnnect();
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
        state.isCopyDisabled = false;
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
  makeAudioCall: (_event: any, model: any, element: any, _attribute: any, object: any) => {
    const target = parseInt(element.id.split("_")[1]);
    const source = object.$parent.$model.myIndex;
    console.log("trg/src", target, source);

    const remoteID = object.$parent.$model.users[target].peerID;
    console.log("remote: ", remoteID);
    if (target == source) return;
    if (remoteID == undefined) return;

    console.log("calling: ", remoteID);
    //call(remoteID, target, source, true);
    myConnection.mkCall({ to: target, from: source, type: callType.Audio });
  },
  updateRoomID: () => {
    if (state.roomID != "" && state.isLoginDisabled == true) state.isConnectDisabled = false;
  },
  mute: (_event: any, _model: any, element: any) => {
    //get element Index that clicked mute
    const mutedChannel = parseInt(element.id.split("_")[1]);
    console.log(mutedChannel);
    const rslt = streams[mutedChannel].getTracks();
    console.log(rslt);
    if (state.localUIuser[mutedChannel].isMuted) {
      rslt.forEach((t: any) => {
        if (t.kind == "audio") {
          t.enabled = true;
          state.localUIuser[mutedChannel].isMuted = false;
        }
      });
    } else {
      rslt.forEach((t: any) => {
        if (t.kind == "audio") {
          t.enabled = false;
          state.localUIuser[mutedChannel].isMuted = true;
        }
      });
    }
    console.log(state.localUIuser);
  },
  disconnect: (_event: any, _model: any, element: any) => {
    myConnection.endCall({ from: state.myIndex });
  },
  createlink: () => {
    if (state.roomID != "") {
      let copyString = `https://hathoravoip.netlify.app/?roomID=${state.roomID}`;
      navigator.clipboard.writeText(copyString);
    }
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
            <button \${click@=>create} \${disabled <== isCreateDisabled} >Create Room</button>
            <label>Player Name</label><input id="name" type="text" \${value<=>name}>
            <div class="instructions">
          <p>First you must login to the Hathora Server by clicking 'Login'</p>
          <p>Then 'someone' needs to create the Room for the call... this will create a RoomID that populates below.  This needs shared as others on the call will need this ID string. </p>
          <p>You cannot connect to the Room if you leave the Name field as 'Name' it must be changed to something else </p>
          <p>If you create the room, you can now click the connect button, it will connect to the room, and grab a PeerID value... once this is established, you can click 'Enter Room' and your avatar cirle will appear as well with any others already in room </p>
          <p>If you didn't create the room, you need the RoomID from someone else, paste it into the RoomID field, and follow same instructions as earlier. </p>
          <p>You will have access to a audio/video buttons on anothers avatar.  These initiate calls to the others in rooms.  When call is accepted, you have access to mute and end buttons </p>

        </div>
        </div>

        

        <div class="section">
            <label>Room ID</label><input type="text" \${disabled <== isRoomIdDisabled} \${input@=>updateRoomID} \${value<=>roomID}>
            <button \${click@=>connect} \${disabled <== isConnectDisabled}>Connect</button>
            <button \${click@=>join} \${disabled <== isJoinDisabled} >Enter Room</button>
            <button \${click@=>createlink} \${disabled <== isCopyDisabled}>copy link</button>
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
              <button id="CC_\${user.id}" \${===user.isCallActive} \${click@=>disconnect}>End</button> 
            </div>
            <div class="zoomcrop" style="border: 1px solid white;" >
              <video id="myvid\${user.id}"></video>
              <div class="nameplacard">\${user.name}</div>
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

//get roomID from path if available
/* var pathArray = window.location.href.split("/");
console.log(pathArray);
if (pathArray.length == 5) {
  state.roomID = pathArray[4];
} */

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
if (urlParams.has("roomID")) {
  state.roomID = urlParams.get("roomID");
  console.log("Room is: ", state.roomID);
} else {
  const path = window.location.href;
  const room = path.split("/");
  console.log(room);
}

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
    if (!state.localUIuser[user.index]) {
      state.localUIuser[user.index] = {
        id: user.index,
        name: state.users[user.index].name,
        isCallActive: false,
        isVisible: false,
        isMuted: false,
      };
      if (state.myIndex != index) state.localUIuser[user.index].isVisible = true;
    }
  });

  if (update.events.length) {
    console.log("EVENTS: ", update.events);
    update.events.forEach(event => {
      if (event.type == HathoraEventTypes.make) {
        const { fromIndex } = event.val;
        if (fromIndex != state.myIndex) {
          state.modal.from = state.users[fromIndex].name;
          state.modal.type = event.val.type;
        } else {
          if (event.val.type == callType.Video) call(event.val.toID, event.val.toIndex, event.val.fromIndex, true);
          else if (event.val.type == callType.Audio) call(event.val.toID, event.val.toIndex, event.val.fromIndex, false);
        }
      } else if (event.type == HathoraEventTypes.end) {
        endCall(event.val.fromID, event.val.fromIndex);
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
    streams[src] = await getUserMedia({ video: video, audio: true });
    const call = myPeer.call(remotePeerID, streams[src], {});
    call.on("stream", (remoteStream: any) => {
      streams[trg] = remoteStream;
      //localStream
      const srcCntrl: any = document.getElementById(`myvid${src}`);
      srcCntrl.srcObject = streams[src];
      srcCntrl.play();

      //called stream
      const vidCntrl: any = document.getElementById(`myvid${trg}`);
      vidCntrl.srcObject = streams[trg];
      vidCntrl.play();

      state.localUIuser[trg].isCallActive = true;
      state.localUIuser[trg].isVisible = false;
      state.localUIuser[src].isCallActive = true;
      state.localUIuser[src].isVisible = true;
    });
  } catch (error) {
    window.alert(error);
  }
  console.log("streams: ", streams);
};

const answer = async (call: MediaConnection, type: callType) => {
  const src = state.myIndex;
  const callerID = call.peer;
  const callerIndex = state.users.findIndex((u: any) => {
    return u.peerID == callerID;
  });
  let getUserMedia = navigator.mediaDevices.getUserMedia;
  try {
    if (type == callType.Video) streams[src] = await getUserMedia({ video: true, audio: true });
    else if (type == callType.Audio) streams[src] = await getUserMedia({ video: false, audio: true });
    call.answer(streams[src]);
    call.on("stream", (remoteStream: any) => {
      //localStream
      streams[callerIndex] = remoteStream;
      const srcCntrl: any = document.getElementById(`myvid${src}`);
      srcCntrl.srcObject = streams[src];
      srcCntrl.play();
      //incoming stream from caller
      const vidCntrl: any = document.getElementById(`myvid${callerIndex}`);
      vidCntrl.srcObject = streams[callerIndex];
      vidCntrl.play();

      state.localUIuser[callerIndex].isCallActive = true;
      state.localUIuser[callerIndex].isVisible = false;
      state.localUIuser[src].isCallActive = true;
      state.localUIuser[src].isVisible = true;
      state.modal.isVisible = false;
    });
  } catch (error) {
    window.alert(error);
  }

  console.log("streams: ", streams);
};

const showModal = (call: any) => {
  state.modal.isVisible = true;
};

const endCall = (localID: string, localIndex: number) => {
  //loop through media streams and end them
  streams.forEach((stream: any) => {
    if (stream) {
      const rslt = stream.getTracks();
      rslt.forEach((track: any) => {
        track.stop();
      });
    }
  });
  //loop through peer connections and end them
  const conns = myPeer.connections;
  console.log(conns);
  //conns.array.forEach((connection: any) => connection.close());
  Object.keys(conns).forEach((connection: any) => {
    conns[connection].forEach((c: any) => {
      c.close();
    });
  });

  //clear out streams array
  streams.fill(null, 0, 3);

  //stop video elements and update UI
  state.localUIuser.forEach((user: any, index: number) => {
    console.log("looping through localUsers", index);
    const vidCntrl = document.getElementById(`myvid${index}`);
    console.log(vidCntrl);
    (vidCntrl as HTMLVideoElement).pause();
    (vidCntrl as HTMLVideoElement).load();
    user.isCallActive = false;
    user.isMuted = false;
    if (state.myIndex != index) user.isVisible = true;
    else user.isVisible = false;
  });
};
