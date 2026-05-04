from fastapi import FastAPI, Request, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import httpx
import math
import os


app= FastAPI(tittle="Cafe-Spot")
GOOGlE_API_KEY = os.getenv("GOOGLE_API_KEY", "AIzaSyAyhvagv40seo7ezXCU1n0h9v_UtwcjqkY")

@app.get("/api/geocode")

async def geocode(address: str = Query(..., description="Address to geocode")):
    url = f"https://maps.googleapis.com/maps/api/geocode/json?address={address}&key={GOOGlE_API_KEY}"


    async with httpx.AsyncClient() as client:

        response = await client.get(url)
        data = response.json()
    if data["status"] == "OK":

        return JSONResponse(status_code= 400, content={"error": "Geocoding failed", "details": data})
    result =data ["results"][0]
    location = result["geometry"]["location"]
    return {"lat": location["lat"], "lng": location["lng"]}

@app.get("/api/cafes") 

async def get_cafes(lat: float = Query(...), lng: float = Query(...), radius: int = Query(1500, ge=100, le=10000, description= "search radius in meters")):
    url = f"https://maps.googleapis.com/maps/api/place/nearbysearch/json?location={lat},{lng}&radius={radius}&type=cafe&key={GOOGlE_API_KEY}"
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        data = response.json()
    if data["status"] != "OK":
        return JSONResponse(status_code=400, content={"error": "Places API request failed", "details": data})
    
    cafes = []
    for place in data.get("results", []):
        place_lat = place["geometry"]["location"]["lat"]
        place_lng = place["geometry"]["location"]["lng"]
        d_lat = math.radians(place_lat - lat)
        d_lng = math.radians(place_lng - lng)
        a = math.sin(d_lat / 2) ** 2 + math.cos(math.radians(lat)) * math.cos(math.radians(place_lat)) * math.sin(d_lng / 2) ** 2
        distance_km = round(6371 * 2 * math.asin(math.sqrt(a)), 2)
        photo_ref = None
        if place.get("photos"):
            photo_ref = place["photos"][0]["photo_reference"]
        cafes.append({
            "name": place["name"],
            "address": place.get("vicinity", ""),
            "lat": place_lat,
            "lng": place_lng,
            "rating": place.get("rating"),
            "opening_hours": place.get("opening_hours", {}).get("open_now"),
            "user_ratings_total": place.get("user_ratings_total"),
            "distance_km": distance_km,
            "photo_reference": photo_ref
        })

    cafes.sort(key=lambda x: x["distance_km"])
    return {"cafes": cafes, "count": len(cafes)}

@app.get("/api/photo")
async def get_photo(photo_reference: str, max_width: int =400):
    url = f"https://maps.googleapis.com/maps/api/place/photo?maxwidth={max_width}&photoreference={photo_reference}&key={GOOGlE_API_KEY}"
    async with httpx.AsyncClient(follow_redirects=True) as client:
        response = await client.get(url)
    
    return JSONResponse(content={"photo_url": response.url})


app.mount("/", StaticFiles(directory="web", html=True), name="web")

if __name__ == "__main__":
    
    import uvicorn

    uvicorn.run("main:app", host="localhost", port=8080, reload=True)