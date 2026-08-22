from pydantic import BaseModel


class SeedDataResponse(BaseModel):
    success: bool = True
    districts_created: int
    facilities_created: int
    medicines_created: int
    batches_created: int
    consumption_records_created: int
    message: str
