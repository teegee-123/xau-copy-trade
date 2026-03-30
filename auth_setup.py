"""
Telegram Authentication Setup Script

Run this script to authenticate with Telegram and create the session file.
This only needs to be done once.

Usage:
    python auth_setup.py
"""

import asyncio
from telethon import TelegramClient

# Import config from backend
import sys
sys.path.append('.')

from backend.config import get_telegram_config

async def main():
    config = get_telegram_config()
    
    print("=" * 60)
    print("XAU Copy Trade - Telegram Authentication Setup")
    print("=" * 60)
    print()
    print(f"Phone: {config['phone']}")
    print(f"Session: backend/{config['session_name']}.session")
    print()
    
    # Create client
    client = TelegramClient(
        'backend/' + config['session_name'],
        config['api_id'],
        config['api_hash']
    )
    
    await client.connect()
    
    if not await client.is_user_authorized():
        print("Sending authentication code...")
        print()
        
        try:
            await client.send_code_request(config['phone'])
        except Exception as e:
            print(f"Error sending code: {e}")
            print("Please check your API credentials in .env file")
            await client.disconnect()
            return
        
        # Get phone code
        code = input("Enter the code you received from Telegram: ")
        
        try:
            await client.sign_in(
                phone=config['phone'], 
                code=code
            )
        except Exception as e:
            if "password" in str(e).lower():
                # Two-factor authentication required
                password = input("Enter your 2FA password: ")
                await client.sign_in(password=password)
            else:
                print(f"Authentication error: {e}")
                await client.disconnect()
                return
        
        print()
        print("=" * 60)
        print("✓ Authentication successful!")
        print("=" * 60)
        print()
        print(f"Session file created at: backend/{config['session_name']}.session")
        print()
        print("You can now run the main application:")
        print("  python -m uvicorn backend.main:app --reload --port 8001")
    else:
        print("Already authorized!")
    
    await client.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
