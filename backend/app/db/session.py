from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession , create_async_engine
from sqlalchemy.orm import sessionmaker 
from typing import AsyncGenerator
import os

load_dotenv()

DATABASE_URL=os.getenv("db_url")

engine = create_async_engine(DATABASE_URL , echo=True)

# this is creating a context manager which closes a db session automatically
AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# we can call the context manager wherever we want with this function 
async def get_async_db() -> AsyncGenerator[AsyncSession , None]:
    async with AsyncSessionLocal() as session :
        yield session

