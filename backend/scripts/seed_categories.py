import asyncio
import json
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.features.categories.models import Category, Subcategory
import app.models.model_registry  # Required for SQLAlchemy relationship resolution

# Path to the categories.json file
DATA_FILE = Path(__file__).parent / "data" / "categories.json"

async def seed_categories():
    print("Starting category seeding...")
    
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    async with AsyncSessionLocal() as session:
        for parent_name, sub_names in data.items():
            # 1. Check if parent exists
            result = await session.execute(select(Category).where(Category.name == parent_name))
            parent = result.scalars().first()
            
            if not parent:
                print(f"Creating parent category: {parent_name}")
                parent = Category(name=parent_name)
                session.add(parent)
                await session.flush() # To get the parent.id immediately
                
            # 2. Check and insert subcategories
            for sub_name in sub_names:
                sub_result = await session.execute(
                    select(Subcategory).where(
                        Subcategory.category_id == parent.id,
                        Subcategory.name == sub_name
                    )
                )
                sub = sub_result.scalars().first()
                
                if not sub:
                    print(f"  - Creating subcategory: {sub_name}")
                    sub = Subcategory(category_id=parent.id, name=sub_name)
                    session.add(sub)
                    
        print("Committing to database...")
        await session.commit()
        print("Seeding complete!")

if __name__ == "__main__":
    asyncio.run(seed_categories())
