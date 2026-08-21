"""Create deterministic synthetic Phase 1 demo data. Never use patient data."""

import random
from datetime import date, timedelta

from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.core import ConsumptionRecord, District, Facility, InventoryBatch, Medicine, Warehouse, User


MEDICINES = [
    ("Amoxicillin 500 mg", "Amoxicillin", "Antibiotic", "tablets"),
    ("Paracetamol 500 mg", "Paracetamol", "Analgesic", "tablets"),
    ("ORS Sachet", "Oral Rehydration Salts", "Rehydration", "sachets"),
    ("Insulin 100 IU/ml", "Human Insulin", "Diabetes", "vials"),
    ("Metformin 500 mg", "Metformin", "Diabetes", "tablets"),
    ("Cetirizine 10 mg", "Cetirizine", "Antihistamine", "tablets"),
    ("Azithromycin 500 mg", "Azithromycin", "Antibiotic", "tablets"),
    ("Zinc 20 mg", "Zinc Sulphate", "Supplement", "tablets"),
    ("Iron Folic Acid", "Ferrous Fumarate", "Supplement", "tablets"),
    ("Amlodipine 5 mg", "Amlodipine", "Cardiovascular", "tablets"),
    ("Salbutamol Inhaler", "Salbutamol", "Respiratory", "inhalers"),
    ("Clotrimazole Cream", "Clotrimazole", "Dermatology", "tubes"),
    ("Dextrose 5%", "Dextrose", "IV Fluid", "bottles"),
    ("Cefixime 200 mg", "Cefixime", "Antibiotic", "tablets"),
    ("Vitamin A", "Retinol", "Supplement", "capsules"),
]


def main() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(District).first():
            print("Seed skipped: database already contains data.")
            return

        random.seed(42)
        district = District(name="Ahmedabad Rural", state="Gujarat")
        db.add(district)
        db.flush()
        facilities = [
            Facility(district_id=district.id, name=name, facility_type=kind, latitude=lat, longitude=lng, address="Ahmedabad Rural")
            for name, kind, lat, lng in [
                ("PHC Sanand", "PHC", 22.992, 72.381), ("PHC Rampura", "PHC", 23.011, 72.511),
                ("PHC Kadi", "PHC", 23.300, 72.330), ("PHC Dholka", "PHC", 22.730, 72.440),
                ("PHC Viramgam", "PHC", 23.130, 72.050), ("PHC Detroj", "PHC", 23.340, 72.190),
                ("CHC Bavla", "CHC", 22.820, 72.370), ("CHC Mandal", "CHC", 23.290, 71.920),
                ("Ahmedabad Rural District Hospital", "DISTRICT_HOSPITAL", 23.040, 72.560),
            ]
        ]
        warehouse = Warehouse(district_id=district.id, name="Ahmedabad Rural District Warehouse", latitude=23.040, longitude=72.560, address="District Health Campus")
        medicines = [Medicine(name=name, generic_name=generic, category=category, unit=unit, manufacturer="Aarogya Supplies") for name, generic, category, unit in MEDICINES]
        db.add_all(facilities + [warehouse] + medicines)
        db.flush()

        today = date.today()
        for facility in facilities:
            for medicine in medicines:
                quantity = random.randint(180, 900)
                if facility.name == "PHC Sanand" and medicine.name == "Amoxicillin 500 mg": quantity = 126
                if facility.name == "PHC Rampura" and medicine.name == "Insulin 100 IU/ml": quantity = 700
                if facility.name == "CHC Bavla" and medicine.name == "Amoxicillin 500 mg": quantity = 1420
                db.add(InventoryBatch(facility_id=facility.id, medicine_id=medicine.id, batch_number=f"{facility.name[:3].upper()}-{medicine.id.hex[:5]}", quantity=quantity, expiry_date=today + timedelta(days=random.randint(45, 420))))
                for days_ago in range(1, 91):
                    db.add(ConsumptionRecord(facility_id=facility.id, medicine_id=medicine.id, date=today - timedelta(days=days_ago), quantity_consumed=random.randint(4, 22), patient_count=random.randint(8, 40)))
        for medicine in medicines:
            db.add(InventoryBatch(warehouse_id=warehouse.id, medicine_id=medicine.id, batch_number=f"WH-{medicine.id.hex[:6]}", quantity=random.randint(1200, 3000), expiry_date=today + timedelta(days=random.randint(120, 540))))

        sanand_facility = next(f for f in facilities if "Sanand" in f.name)
        rampura_facility = next(f for f in facilities if "Rampura" in f.name)
        users_to_seed = [
            User(
                firebase_uid="mock-district-admin",
                name="Dr. Amit Patel",
                email="district.admin@aarogyagrid.org",
                role="DISTRICT_ADMIN",
                district_id=district.id,
                status="ACTIVE"
            ),
            User(
                firebase_uid="mock-facility-admin-sanand",
                name="Dr. Priya Shah",
                email="sanand.admin@aarogyagrid.org",
                role="FACILITY_ADMIN",
                facility_id=sanand_facility.id,
                district_id=district.id,
                status="ACTIVE"
            ),
            User(
                firebase_uid="mock-healthcare-staff-sanand",
                name="Nurse Ramesh Kumar",
                email="sanand.staff@aarogyagrid.org",
                role="HEALTHCARE_STAFF",
                facility_id=sanand_facility.id,
                district_id=district.id,
                status="ACTIVE"
            ),
            User(
                firebase_uid="mock-warehouse-manager",
                name="Rajesh Sharma",
                email="warehouse.manager@aarogyagrid.org",
                role="WAREHOUSE_MANAGER",
                district_id=district.id,
                status="ACTIVE"
            ),
            User(
                firebase_uid="mock-facility-admin-rampura",
                name="Dr. Vikram Mehta",
                email="rampura.admin@aarogyagrid.org",
                role="FACILITY_ADMIN",
                facility_id=rampura_facility.id,
                district_id=district.id,
                status="ACTIVE"
            )
        ]
        db.add_all(users_to_seed)
        db.commit()
        print("Synthetic Phase 1 data seeded.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
