import os
import sqlite3
import json
import logging
from typing import Optional
from fastapi import FastAPI, HTTPException, Header, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import requests
from dotenv import load_dotenv

load_dotenv()

class Logger:
    def __init__(self, sports: str = "fitness"):
        self.sports = sports
    def log(self, level: str, message: str):
        print(f"[{level.upper()}] [{self.sports}] {message}")

logger = Logger(sports="nutrition")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "daily_routine.db"
SETTINGS_PATH = "settings.json"

def get_settings():
    if os.path.exists(SETTINGS_PATH):
        with open(SETTINGS_PATH, "r") as f:
            return json.load(f)
    return {
        "openrouter_key": os.getenv("OPENROUTER_API_KEY", ""),
        "openrouter_model": os.getenv("OPENROUTER_MODEL", "google/gemini-2.5-flash"),
        "user_password": os.getenv("USER_PASSWORD", ""),
        "admin_password": os.getenv("ADMIN_PASSWORD", ""),
        "user_weakness": os.getenv("USER_WEAKNESS", "")
    }

def save_settings(settings):
    with open(SETTINGS_PATH, "w") as f:
        json.dump(settings, f)

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    sports = "nutrition"
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS meals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            meal_type TEXT,
            food_name TEXT,
            calories REAL,
            protein REAL,
            carbs REAL,
            fat REAL,
            vitamin_c REAL,
            vitamin_d REAL,
            vitamin_a REAL,
            calcium REAL,
            iron REAL,
            sports TEXT
        )
    """)
    conn.commit()
    conn.close()
    logger.log("info", "Database initialized")

init_db()

class LoginRequest(BaseModel):
    password: str

class MealItem(BaseModel):
    date: str
    meal_type: str
    food_name: str

class SettingsUpdate(BaseModel):
    openrouter_key: str
    openrouter_model: str
    user_password: str
    admin_password: str
    user_weakness: Optional[str] = ""

def verify_token(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing auth header")
    token = authorization.replace("Bearer ", "")
    settings = get_settings()
    user_pwd = settings.get("user_password") or os.getenv("USER_PASSWORD", "")
    admin_pwd = settings.get("admin_password") or os.getenv("ADMIN_PASSWORD", "")
    if not user_pwd and not admin_pwd:
        raise HTTPException(status_code=401, detail="No credentials set")
    if token != user_pwd and token != admin_pwd:
        raise HTTPException(status_code=401, detail="Invalid token")
    return token

@app.post("/api/login")
def login(req: LoginRequest):
    settings = get_settings()
    user_pwd = settings.get("user_password") or os.getenv("USER_PASSWORD", "")
    admin_pwd = settings.get("admin_password") or os.getenv("ADMIN_PASSWORD", "")
    if not user_pwd and not admin_pwd:
        raise HTTPException(status_code=401, detail="No credentials set")
    if req.password == user_pwd:
        return {"token": user_pwd, "role": "user"}
    elif req.password == admin_pwd:
        return {"token": admin_pwd, "role": "admin"}
    raise HTTPException(status_code=401, detail="Invalid credentials")

@app.get("/api/settings")
def api_get_settings(token: str = Depends(verify_token)):
    settings = get_settings()
    return {
        "openrouter_key": settings.get("openrouter_key", ""),
        "openrouter_model": settings.get("openrouter_model", ""),
        "user_password": "●●●●●●" if settings.get("user_password") or os.getenv("USER_PASSWORD") else "",
        "admin_password": "●●●●●●" if settings.get("admin_password") or os.getenv("ADMIN_PASSWORD") else "",
        "user_weakness": settings.get("user_weakness", "")
    }

@app.post("/api/settings")
def api_save_settings(settings: SettingsUpdate, token: str = Depends(verify_token)):
    current = get_settings()
    data = settings.dict()
    if data["user_password"] == "●●●●●●":
        data["user_password"] = current.get("user_password") or os.getenv("USER_PASSWORD", "")
    if data["admin_password"] == "●●●●●●":
        data["admin_password"] = current.get("admin_password") or os.getenv("ADMIN_PASSWORD", "")
    save_settings(data)
    return {"status": "success"}

@app.get("/api/meals")
def get_meals(date: str, token: str = Depends(verify_token)):
    sports = "nutrition"
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, date, meal_type, food_name, calories, protein, carbs, fat, vitamin_c, vitamin_d, vitamin_a, calcium, iron, sports
        FROM meals
        WHERE date = ? AND sports = ?
    """, (date, sports))
    rows = cursor.fetchall()
    conn.close()
    meals = []
    for r in rows:
        meals.append({
            "id": r[0],
            "date": r[1],
            "meal_type": r[2],
            "food_name": r[3],
            "calories": r[4],
            "protein": r[5],
            "carbs": r[6],
            "fat": r[7],
            "vitamin_c": r[8],
            "vitamin_d": r[9],
            "vitamin_a": r[10],
            "calcium": r[11],
            "iron": r[12],
            "sports": r[13]
        })
    return meals

def parse_and_update_nutrients(meal_id: int, food_name: str, key: str, model: str):
    if not key or not food_name.strip():
        return
    sports = "nutrition"
    nutrients = {
        "calories": 150.0,
        "protein": 5.0,
        "carbs": 20.0,
        "fat": 5.0,
        "vitamin_c": 10.0,
        "vitamin_d": 1.0,
        "vitamin_a": 50.0,
        "calcium": 20.0,
        "iron": 1.0
    }
    try:
        prompt = f"Analyze nutrients for a portion of: {food_name}. Return strictly valid JSON object with keys: calories (kcal), protein (g), carbs (g), fat (g), vitamin_c (mg), vitamin_d (mcg), vitamin_a (mcg), calcium (mg), iron (mg). No markdown, no comments, no extra text."
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}]
        }
        res = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=body, timeout=10)
        if res.status_code == 200:
            data = res.json()
            content = data["choices"][0]["message"]["content"].strip()
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            parsed = json.loads(content)
            for k in nutrients.keys():
                if k in parsed:
                    nutrients[k] = float(parsed[k])
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE meals
                SET calories = ?, protein = ?, carbs = ?, fat = ?, vitamin_c = ?, vitamin_d = ?, vitamin_a = ?, calcium = ?, iron = ?
                WHERE id = ? AND sports = ?
            """, (nutrients["calories"], nutrients["protein"], nutrients["carbs"], nutrients["fat"], nutrients["vitamin_c"], nutrients["vitamin_d"], nutrients["vitamin_a"], nutrients["calcium"], nutrients["iron"], meal_id, sports))
            conn.commit()
            conn.close()
    except Exception as e:
        logger.log("error", f"Async OpenRouter parsing failed: {e}")

@app.post("/api/meals")
def add_meal(meal: MealItem, background_tasks: BackgroundTasks, token: str = Depends(verify_token)):
    sports = "nutrition"
    settings = get_settings()
    key = settings.get("openrouter_key", "")
    model = settings.get("openrouter_model", "google/gemini-2.5-flash")
    
    calories = 150.0
    protein = 5.0
    carbs = 20.0
    fat = 5.0
    vitamin_c = 10.0
    vitamin_d = 1.0
    vitamin_a = 50.0
    calcium = 20.0
    iron = 1.0

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO meals (date, meal_type, food_name, calories, protein, carbs, fat, vitamin_c, vitamin_d, vitamin_a, calcium, iron, sports)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (meal.date, meal.meal_type, meal.food_name, calories, protein, carbs, fat, vitamin_c, vitamin_d, vitamin_a, calcium, iron, sports))
    meal_id = cursor.lastrowid
    conn.commit()
    conn.close()

    if key and meal.food_name.strip():
        background_tasks.add_task(parse_and_update_nutrients, meal_id, meal.food_name, key, model)

    return {"status": "success", "meal_id": meal_id}

@app.get("/api/analyze")
def analyze_day(date: str, token: str = Depends(verify_token)):
    sports = "nutrition"
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT meal_type, food_name, calories, protein, carbs, fat, vitamin_c, vitamin_d, vitamin_a, calcium, iron, sports
        FROM meals
        WHERE date = ? AND sports = ?
    """, (date, sports))
    rows = cursor.fetchall()
    conn.close()
    
    if not rows:
        return {"analysis": "No meals logged for today yet. Add meals to see analysis."}
        
    settings = get_settings()
    key = settings.get("openrouter_key", "")
    model = settings.get("openrouter_model", "google/gemini-2.5-flash")
    
    meals_summary = []
    total_nutrients = {
        "calories": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0,
        "vitamin_c": 0.0, "vitamin_d": 0.0, "vitamin_a": 0.0, "calcium": 0.0, "iron": 0.0
    }
    
    for r in rows:
        meals_summary.append(f"{r[0]}: {r[1]}")
        total_nutrients["calories"] += r[2] or 0.0
        total_nutrients["protein"] += r[3] or 0.0
        total_nutrients["carbs"] += r[4] or 0.0
        total_nutrients["fat"] += r[5] or 0.0
        total_nutrients["vitamin_c"] += r[6] or 0.0
        total_nutrients["vitamin_d"] += r[7] or 0.0
        total_nutrients["vitamin_a"] += r[8] or 0.0
        total_nutrients["calcium"] += r[9] or 0.0
        total_nutrients["iron"] += r[10] or 0.0
        
    summary_text = "\n".join(meals_summary)
    nutrients_text = json.dumps(total_nutrients, indent=2)
    
    if not key:
        return {"analysis": "Please configure your OpenRouter API Key in settings to get detailed AI feedback."}
        
    user_weakness = settings.get("user_weakness", "")
    weakness_instruction = f"\nTake into account that the user has the following health conditions/weaknesses: {user_weakness}. Structure recommendations to specifically address and mitigate these issues." if user_weakness else ""

    prompt = (
        f"Today is {date}. Here is my food intake for today:\n{summary_text}\n\n"
        f"Calculated nutrient totals:\n{nutrients_text}\n\n"
        f"Assume the user is a vegetarian from Gujarat, India. Analyze this intake. Point out what was missed, if I lack vitamins or minerals, "
        f"and give constructive suggestions. Suggestions must be strictly vegetarian and tailored to Indian/Gujarati cuisine. Keep your response bulleted, concise and action-oriented.{weakness_instruction}"
    )
    
    try:
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}]
        }
        res = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=body, timeout=15)
        if res.status_code == 200:
            return {"analysis": res.json()["choices"][0]["message"]["content"]}
        return {"analysis": f"Error from OpenRouter: {res.text}"}
    except Exception as e:
        logger.log("error", f"OpenRouter analysis request failed: {e}")
        return {"analysis": f"Request failed: {str(e)}"}

@app.get("/api/admin/report")
def get_admin_report(token: str = Depends(verify_token)):
    settings = get_settings()
    admin_pwd = settings.get("admin_password") or os.getenv("ADMIN_PASSWORD", "")
    if not admin_pwd or token != admin_pwd:
        raise HTTPException(status_code=403, detail="Forbidden")
    sports = "nutrition"
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT date, meal_type, food_name, calories, protein, carbs, fat, vitamin_c, vitamin_d, vitamin_a, calcium, iron, sports
        FROM meals
        WHERE sports = ?
        ORDER BY date DESC
    """, (sports,))
    rows = cursor.fetchall()
    conn.close()
    report = {}
    for r in rows:
        date_str = r[0]
        if date_str not in report:
            report[date_str] = {
                "date": date_str,
                "meals": [],
                "calories": 0.0,
                "protein": 0.0,
                "carbs": 0.0,
                "fat": 0.0,
                "vitamin_c": 0.0,
                "vitamin_d": 0.0,
                "vitamin_a": 0.0,
                "calcium": 0.0,
                "iron": 0.0
            }
        day = report[date_str]
        day["meals"].append(f"{r[1].capitalize()}: {r[2]}")
        day["calories"] += r[3] or 0.0
        day["protein"] += r[4] or 0.0
        day["carbs"] += r[5] or 0.0
        day["fat"] += r[6] or 0.0
        day["vitamin_c"] += r[7] or 0.0
        day["vitamin_d"] += r[8] or 0.0
        day["vitamin_a"] += r[9] or 0.0
        day["calcium"] += r[10] or 0.0
        day["iron"] += r[11] or 0.0
    for date_str, day in report.items():
        lacking = []
        if day["calories"] < 2000: lacking.append("Calories")
        if day["protein"] < 50: lacking.append("Protein")
        if day["vitamin_c"] < 90: lacking.append("Vitamin C")
        if day["vitamin_d"] < 15: lacking.append("Vitamin D")
        if day["vitamin_a"] < 900: lacking.append("Vitamin A")
        if day["calcium"] < 1000: lacking.append("Calcium")
        if day["iron"] < 18: lacking.append("Iron")
        day["lacking"] = lacking
    return list(report.values())

if os.path.exists("dist"):
    app.mount("/", StaticFiles(directory="dist", html=True), name="static")
