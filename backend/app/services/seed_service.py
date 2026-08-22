import random
import uuid
from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.core import (
    ConsumptionRecord,
    District,
    Facility,
    InventoryBatch,
    Medicine,
    User,
    Warehouse,
)
from app.schemas.seed import SeedDataResponse

MEDICINE_CATALOG = [
    {"name": "Paracetamol 500mg", "generic": "Paracetamol", "category": "Analgesics", "unit": "tablets"},
    {"name": "ORS Powder", "generic": "Oral Rehydration Salts", "category": "Essential", "unit": "sachets"},
    {"name": "Amoxicillin 500mg", "generic": "Amoxicillin", "category": "Antibiotics", "unit": "capsules"},
    {"name": "Insulin 100IU", "generic": "Insulin Human", "category": "Hormones", "unit": "vials"},
    {"name": "Azithromycin 500mg", "generic": "Azithromycin", "category": "Antibiotics", "unit": "tablets"},
    {"name": "Metformin 500mg", "generic": "Metformin", "category": "Antidiabetic", "unit": "tablets"},
    {"name": "Iron Folic Acid", "generic": "IFA Supplement", "category": "Maternal Health", "unit": "tablets"},
    {"name": "Rabies Vaccine", "generic": "Anti-Rabies Vaccine", "category": "Vaccines", "unit": "vials"},
]

DISTRICTS = [
    {"name": "Ahmedabad Rural", "state": "Gujarat", "lat": 23.0225, "lng": 72.5714},
    {"name": "Gandhinagar", "state": "Gujarat", "lat": 23.2156, "lng": 72.6369},
    {"name": "Vadodara", "state": "Gujarat", "lat": 22.3072, "lng": 73.1812},
]


def seed_demo_database(db: Session) -> SeedDataResponse:
    today = date.today()

    # 1. Create Medicines
    med_objs: list[Medicine] = []
    for item in MEDICINE_CATALOG:
        existing = db.scalars(select(Medicine).where(Medicine.name == item["name"])).first()
        if not existing:
            med = Medicine(
                name=item["name"],
                generic_name=item["generic"],
                category=item["category"],
                unit=item["unit"],
                manufacturer="Gujarat Medical Services Corp",
            )
            db.add(med)
            med_objs.append(med)
        else:
            med_objs.append(existing)
    db.flush()

    # 2. Create Districts & Facilities
    facility_objs: list[Facility] = []
    for d_data in DISTRICTS:
        dist = db.scalars(select(District).where(District.name == d_data["name"])).first()
        if not dist:
            dist = District(name=d_data["name"], state=d_data["state"], status="ACTIVE")
            db.add(dist)
            db.flush()

        # Add 3 facilities per district
        fac_names = [f"PHC {dist.name} Sector 1", f"CHC {dist.name} Sector 2", f"PHC {dist.name} Sector 3"]
        for i, fname in enumerate(fac_names):
            existing_f = db.scalars(select(Facility).where(Facility.name == fname)).first()
            if not existing_f:
                fac = Facility(
                    district_id=dist.id,
                    name=fname,
                    facility_type="PHC" if i != 1 else "CHC",
                    latitude=d_data["lat"] + (i * 0.05),
                    longitude=d_data["lng"] + (i * 0.05),
                    status="ACTIVE",
                )
                db.add(fac)
                facility_objs.append(fac)
            else:
                facility_objs.append(existing_f)
    db.flush()

    # 3. Create Inventory Batches
    batches_count = 0
    rng = random.Random(42)

    for fac in facility_objs:
        for med in med_objs:
            existing_batch = db.scalars(
                select(InventoryBatch).where(
                    InventoryBatch.facility_id == fac.id,
                    InventoryBatch.medicine_id == med.id,
                )
            ).first()

            if not existing_batch:
                qty = rng.choice([15, 45, 120, 600, 1500])
                expiry_offset = rng.choice([10, 45, 90, 180, 365])
                batch = InventoryBatch(
                    facility_id=fac.id,
                    medicine_id=med.id,
                    batch_number=f"DEMO-{med.name[:3].upper()}-{rng.randint(100, 999)}",
                    quantity=qty,
                    expiry_date=today + timedelta(days=expiry_offset),
                )
                db.add(batch)
                batches_count += 1
    db.flush()

    # 4. Create Historical Consumption
    consumption_count = 0
    for fac in facility_objs[:3]:
        for med in med_objs[:3]:
            for offset in range(30, 0, -3):
                rec = ConsumptionRecord(
                    facility_id=fac.id,
                    medicine_id=med.id,
                    date=today - timedelta(days=offset),
                    quantity_consumed=rng.randint(5, 30),
                    patient_count=rng.randint(10, 50),
                )
                db.add(rec)
                consumption_count += 1

    db.commit()

    return SeedDataResponse(
        success=True,
        districts_created=len(DISTRICTS),
        facilities_created=len(facility_objs),
        medicines_created=len(med_objs),
        batches_created=batches_count,
        consumption_records_created=consumption_count,
        message=f"Successfully seeded demo database with {len(facility_objs)} facilities and {batches_count} inventory batches.",
    )
