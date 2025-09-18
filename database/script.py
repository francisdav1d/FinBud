import pymongo
import os
import json



# Load MongoDB URI
mongo_uri = "mongodb+srv://jeridrinshilbesforever_db_user:kRUlQg3sq97pfIfw@hackathon.asnno3a.mongodb.net/?retryWrites=true&w=majority&appName=Hackathon"

# Connect to MongoDB
client = pymongo.MongoClient(mongo_uri)
db = client["FinBot"]  # Database name
patients_collection = db["revenue_smc"]  # Collection name

# Read patients.json
with open("income_history_smc.json", "r", encoding="utf-8") as f:
    patients_data = json.load(f)

# Insert data into 'patients' collection
if isinstance(patients_data, list):
    patients_collection.insert_many(patients_data)
else:
    patients_collection.insert_one(patients_data)

print("Inserted records data into MongoDB.")