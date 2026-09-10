# this file is for database connection test
# running this file you can know if you are connected to the database or not 
from dotenv import load_dotenv
import asyncio
from sqlalchemy import text
import os
from app.db.session import AsyncSessionLocal
 
load_dotenv()

DATABASE_URL=os.getenv("db_url")

async def connection_test():
    try:
        async with AsyncSessionLocal() as db: 
            result = await db.execute(text("SELECT 1"))
            if result:
                print(f"connection successfull , {result}")
    except Exception as err:
        print("connection to the database failed",err)
        
if __name__ == "__main__":
    asyncio.run(connection_test())