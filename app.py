from __future__ import annotations

import random
import socket
import string
from dataclasses import dataclass, field
from typing import Any

import os

from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, join_room

app = Flask(__name__)
app.config["SECRET_KEY"] = "quiz-secret-key"

# Render/production ortaminda gevent kullan; local Windows'ta threading fallback.
async_mode = "gevent" if os.getenv("RENDER") == "true" else "threading"
socketio = SocketIO(app, cors_allowed_origins="*", async_mode=async_mode)


def make_room_code(length: int = 6) -> str:
    return "".join(random.choice(string.digits) for _ in range(length))


def get_local_ip() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"


@dataclass
class Player:
    sid: str
    name: str
    avatar: dict[str, str]
    score: int = 0


@dataclass
class RoomState:
    code: str
    host_sid: str
    players: dict[str, Player] = field(default_factory=dict)
    questions: list[dict[str, Any]] = field(default_factory=list)
    current_index: int = -1
    answers: dict[str, int] = field(default_factory=dict)
    started: bool = False


ROOMS: dict[str, RoomState] = {}
SID_TO_ROOM: dict[str, str] = {}


@app.route("/")
def index():
    return render_template("index.html", local_ip=get_local_ip())


def public_leaderboard(room: RoomState) -> list[dict[str, Any]]:
    return sorted(
        [
            {
                "name": p.name,
                "score": p.score,
                "avatar": p.avatar,
            }
            for p in room.players.values()
        ],
        key=lambda item: item["score"],
        reverse=True,
    )


@socketio.on("host_create_room")
def host_create_room(data):
    questions = data.get("questions", [])
    if not questions:
        emit("error_msg", {"message": "En az 1 soru eklemelisiniz."})
        return

    code = make_room_code()
    while code in ROOMS:
        code = make_room_code()

    room = RoomState(code=code, host_sid=request.sid, questions=questions)
    ROOMS[code] = room
    SID_TO_ROOM[request.sid] = code
    join_room(code)
    emit("room_created", {"code": code})


@socketio.on("player_join")
def player_join(data):
    code = str(data.get("code", "")).strip()
    name = str(data.get("name", "")).strip()[:24]
    avatar = data.get("avatar", {})

    if not code or code not in ROOMS:
        emit("error_msg", {"message": "Oda bulunamadi."})
        return
    if not name:
        emit("error_msg", {"message": "Isim zorunlu."})
        return

    room = ROOMS[code]
    room.players[request.sid] = Player(sid=request.sid, name=name, avatar=avatar)
    SID_TO_ROOM[request.sid] = code
    join_room(code)

    emit("join_success", {"code": code, "name": name})
    emit(
        "lobby_update",
        {"players": public_leaderboard(room), "count": len(room.players)},
        room=code,
    )


@socketio.on("host_start_quiz")
def host_start_quiz(data):
    code = data.get("code", "")
    room = ROOMS.get(code)
    if not room or room.host_sid != request.sid:
        emit("error_msg", {"message": "Bu islem icin yetkiniz yok."})
        return

    room.started = True
    room.current_index = -1
    next_question(room)


def next_question(room: RoomState):
    room.current_index += 1
    room.answers = {}

    if room.current_index >= len(room.questions):
        emit("quiz_finished", {"leaderboard": public_leaderboard(room)}, room=room.code)
        return

    question = room.questions[room.current_index]
    payload = {
        "index": room.current_index + 1,
        "total": len(room.questions),
        "text": question["text"],
        "options": question["options"],
    }
    emit("question_started", payload, room=room.code)


@socketio.on("submit_answer")
def submit_answer(data):
    code = data.get("code", "")
    room = ROOMS.get(code)
    if not room or request.sid not in room.players:
        return

    if request.sid in room.answers:
        return

    try:
        answer_index = int(data.get("answerIndex", -1))
    except (TypeError, ValueError):
        answer_index = -1

    room.answers[request.sid] = answer_index
    current_q = room.questions[room.current_index]

    if answer_index == current_q["correctIndex"]:
        room.players[request.sid].score += 100

    emit("answer_received", {"ok": True})

    if len(room.answers) >= len(room.players):
        emit(
            "question_result",
            {
                "correctIndex": current_q["correctIndex"],
                "leaderboard": public_leaderboard(room),
            },
            room=room.code,
        )


@socketio.on("host_next_question")
def host_next_question(data):
    code = data.get("code", "")
    room = ROOMS.get(code)
    if not room or room.host_sid != request.sid:
        return
    next_question(room)


@socketio.on("disconnect")
def on_disconnect():
    sid = request.sid
    code = SID_TO_ROOM.pop(sid, None)

    if not code or code not in ROOMS:
        return

    room = ROOMS[code]

    if room.host_sid == sid:
        emit("room_closed", {"message": "Yarisma sonlandirildi."}, room=code)
        ROOMS.pop(code, None)
        return

    if sid in room.players:
        room.players.pop(sid, None)
        room.answers.pop(sid, None)
        emit(
            "lobby_update",
            {"players": public_leaderboard(room), "count": len(room.players)},
            room=code,
        )


if __name__ == "__main__":
    # Port cakismasi yasarsan: netstat -ano | findstr :5000
    socketio.run(
        app,
        host="0.0.0.0",
        port=5000,
        debug=True,
        allow_unsafe_werkzeug=True,
    )
