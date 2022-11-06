import { Methods, Context } from "./.hathora/methods";
import { Response } from "../api/base";
import {
  Player,
  callType,
  UserState,
  UserId,
  IInitializeRequest,
  IJoinGameRequest,
  ISetPeerIDRequest,
  IMkCallRequest,
  HathoraEventTypes,
} from "../api/types";

type InternalState = UserState;

export class Impl implements Methods<InternalState> {
  initialize(ctx: Context, request: IInitializeRequest): InternalState {
    return {
      Players: [],
    };
  }
  joinGame(state: InternalState, userId: UserId, ctx: Context, request: IJoinGameRequest): Response {
    const pNum = state.Players.length;
    const name = request.name;
    state.Players.push({
      index: pNum,
      name: name,
      playerID: userId,
      peerID: "",
      isCallActive: false,
      isVisible: false,
    });
    return Response.ok();
  }
  setPeerID(state: InternalState, userId: UserId, ctx: Context, request: ISetPeerIDRequest): Response {
    const pIndex = state.Players.findIndex(p => {
      return p.playerID == userId;
    });
    if (pIndex > -1) state.Players[pIndex].peerID = request.id;
    return Response.ok();
  }
  mkCall(state: InternalState, userId: UserId, ctx: Context, request: IMkCallRequest): Response {
    let { from, to, type } = request;
    let fromID = state.Players[from].peerID;
    let toID = state.Players[to].peerID;
    let toUID = state.Players[to].playerID;
    ctx.sendEvent(HathoraEventTypes.default, { toIndex: to, fromIndex: from, toID, fromID, type }, userId);
    ctx.sendEvent(HathoraEventTypes.default, { toIndex: to, fromIndex: from, toID, fromID, type }, toUID);
    return Response.ok();
  }

  getUserState(state: InternalState, userId: UserId): UserState {
    return state;
  }
}
