import os
import sys
import time
import random
import requests
import threading
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

load_dotenv()

REVIEW_URL = "https://search.google.com/local/writereview?placeid=ChIJK7FSuKRBdkgRSTWp5H8Etv0"
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
PROFILE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".chrome-profile")

PROMPTS = [
    "Write a short, authentic 5-star Google review (2-4 sentences) for Capital Services, a property restoration and insurance claims company in Watford, UK. They handle fire/flood damage restoration, drying, strip-out works, reinstatement, and major loss projects. Make it sound like a real homeowner or business owner. Mention specific services like making safe, drying, or reinstatement naturally. Do NOT use any greeting or sign-off. Just the review text. Be warm, genuine, and unique.",
    "Write a brief, heartfelt 5-star Google review (2-4 sentences) for Capital Services, a UK property care company that handles insurance claims, flood/fire damage, and property restoration. Sound like a genuine customer who had their property restored after damage. Mention their professionalism and quick response. No greeting or sign-off. Just the review.",
    "Compose a glowing 5-star Google review (2-3 sentences) for Capital Services based in Watford/Yateley, UK. They specialize in property damage restoration including strip-out, drying, validation, and reinstatement for insurance claims. Write as if you're a satisfied property owner. Be specific but natural. No greetings or closings.",
    "Create an enthusiastic but genuine 5-star review (2-4 sentences) for Capital Services, a property restoration firm handling insurance work across the UK. Mention their team's expertise in areas like major loss, commercial claims, subsidence, or high net worth properties. Sound real and personal. No opening or closing formalities.",
    "Write a concise, honest-sounding 5-star Google review (2-3 sentences) for Capital Services. They restored a property after significant damage — could be water, fire, or structural. Praise their communication, timeliness, and quality of work. Sound like a real person, not marketing copy. No greetings.",
]

FALLBACKS = [
    "Capital Services were absolutely brilliant after our kitchen flood. Their team arrived quickly, managed the drying and strip-out with real care, and the reinstatement was flawless. Couldn't recommend them highly enough.",
    "After a devastating fire at our property, Capital Services handled everything from making safe to complete reinstatement. Their professionalism and attention to detail throughout the insurance process was exceptional.",
    "We had significant water damage and Capital Services made the entire restoration process seamless. Their drying team was thorough, the communication was excellent, and the final result exceeded our expectations.",
    "Fantastic experience with Capital Services on a major loss project. They coordinated with our insurers brilliantly and delivered a restoration that was better than the original. Truly professional outfit.",
]

review_result = {"text": ""}


def generate_review_async():
    if not GROQ_API_KEY:
        review_result["text"] = random.choice(FALLBACKS)
        return
    try:
        resp = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {GROQ_API_KEY}"},
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {"role": "system", "content": "You write authentic Google reviews. Output ONLY the review text — no quotes, no labels."},
                    {"role": "user", "content": random.choice(PROMPTS)},
                ],
                "temperature": 1.1, "max_tokens": 200, "top_p": 0.95,
            },
            timeout=10,
        )
        resp.raise_for_status()
        review = resp.json()["choices"][0]["message"]["content"].strip().strip("\"'")
        if review:
            review_result["text"] = review
            return
    except:
        pass
    review_result["text"] = random.choice(FALLBACKS)


def main():
    print("CAPITAL SERVICES - Auto Review Bot\n")

    # Start AI generation and Chrome launch in parallel
    ai_thread = threading.Thread(target=generate_review_async)
    ai_thread.start()

    opts = Options()
    opts.add_argument("--start-maximized")
    opts.add_argument("--disable-blink-features=AutomationControlled")
    opts.add_experimental_option("excludeSwitches", ["enable-automation"])
    opts.add_experimental_option("useAutomationExtension", False)
    opts.add_argument(f"--user-data-dir={PROFILE_DIR}")

    driver = None
    for attempt in range(2):
        try:
            driver = webdriver.Chrome(options=opts)
            break
        except Exception as e:
            if attempt == 0:
                print("  Chrome profile locked, cleaning up and retrying...")
                import shutil
                lock_files = ["SingletonLock", "SingletonSocket", "SingletonCookie"]
                for lf in lock_files:
                    p = os.path.join(PROFILE_DIR, lf)
                    try:
                        os.remove(p)
                    except:
                        pass
                time.sleep(1)
            else:
                print(f"Failed to launch: {e}")
                sys.exit(1)

    driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
    driver.get(REVIEW_URL)

    # Wait for review iframe to appear (instead of fixed sleep)
    try:
        iframe = WebDriverWait(driver, 30).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "iframe.goog-reviews-write-widget"))
        )
    except:
        # Might need login
        if "accounts.google.com" in driver.current_url:
            print(">>> SIGN IN to Google in the browser <<<")
            try:
                WebDriverWait(driver, 180).until(lambda d: "accounts.google.com" not in d.current_url)
            except:
                pass
            iframe = WebDriverWait(driver, 30).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "iframe.goog-reviews-write-widget"))
            )
        else:
            # Try alt selector
            try:
                iframe = driver.find_element(By.CSS_SELECTOR, "iframe[aria-label*='review' i]")
            except:
                print("Could not find review iframe.")
                ai_thread.join()
                return

    driver.switch_to.frame(iframe)
    time.sleep(0.5)

    # Wait for AI review to be ready
    ai_thread.join()
    review_text = review_result["text"]
    print(f'Review: "{review_text[:80]}..."\n')

    # Click 5 stars
    star_clicked = driver.execute_script("""
        var all = document.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
            var label = (all[i].getAttribute('aria-label') || '').toLowerCase();
            if ((label.includes('5') || label.includes('five')) && label.includes('star')) {
                all[i].click();
                return true;
            }
        }
        var groups = document.querySelectorAll('[role="radiogroup"]');
        for (var g = 0; g < groups.length; g++) {
            if (groups[g].children.length >= 5) { groups[g].children[4].click(); return true; }
        }
        var radios = document.querySelectorAll('[role="radio"]');
        if (radios.length >= 5) { radios[4].click(); return true; }
        return false;
    """)
    print(f"  Stars: {'OK' if star_clicked else 'FAILED - click manually'}")

    time.sleep(0.5)

    # Fill review text
    text_filled = False
    for sel in ["textarea", "[contenteditable='true']", "[role='textbox']"]:
        els = driver.find_elements(By.CSS_SELECTOR, sel)
        for el in els:
            try:
                el.click()
                time.sleep(0.2)
                el.send_keys(Keys.CONTROL, "a")
                el.send_keys(review_text)
                text_filled = True
                break
            except:
                continue
        if text_filled:
            break

    if not text_filled:
        text_filled = driver.execute_script("""
            var text = arguments[0];
            var ta = document.querySelector('textarea');
            if (ta) { ta.focus(); ta.value = text; ta.dispatchEvent(new Event('input',{bubbles:true})); return true; }
            var ce = document.querySelector('[contenteditable="true"]');
            if (ce) { ce.focus(); ce.innerText = text; ce.dispatchEvent(new Event('input',{bubbles:true})); return true; }
            return false;
        """, review_text)

    print(f"  Text: {'OK' if text_filled else 'FAILED - paste manually'}")
    print(f"\nDone! Verify and click Post.")

    try:
        while True:
            try:
                _ = driver.title
                time.sleep(2)
            except:
                break
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
