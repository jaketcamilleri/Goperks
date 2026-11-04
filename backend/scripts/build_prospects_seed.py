"""Build prospects_seed.json from scripts/prospect_results.json plus Visit Werribee listings.

Only businesses with a publicly listed email are kept. Sends nothing.
Usage: python scripts/build_prospects_seed.py
"""
import json
from pathlib import Path

HERE = Path(__file__).parent
VW = "https://www.visitwerribee.com/food-wine/cafes-street-eats/"

# Email, phone and area as listed on the Visit Werribee (Wyndham tourism) page for each business.
VISIT_WERRIBEE = [
    ("Augustus Gelatery Werribee", "cafes", "Werribee", "https://augustusgelatery.com.au", "scoop@augustusgelatery.com.au", "03 8763 1486", "augustus-gelatery-werribee-0"),
    ("Bean Smuggler", "cafes", "Point Cook", "https://beansmuggler.com.au", "beansmuggler.pointcook@gmail.com", "03 9395 1212", "bean-smuggler"),
    ("Bellissima Italian Pantry", "dining", "Werribee", "https://www.bellissima.com.au", "ciao@bellissima.com.au", "03 9742 2260", "bellissima-italian-pantry"),
    ("Cake Creations by Kate", "cafes", "Point Cook", "https://cakecreationsbykate.com.au", "sales@ccbk.com.au", "03 9395 9656", "cake-creations-kate"),
    ("Chatterbox Cafe", "cafes", "Werribee", "http://www.chatterboxcafe.com.au", "info@chatterboxcafe.com.au", "03 9741 7495", "chatterbox-cafe"),
    ("Fusion Ceylon", "dining", "Werribee", "https://fusionceylon.com.au", "info@fusionceylon.com.au", "0433 696 726", "fusion-ceylon"),
    ("The Garden Feast", "cafes", "Werribee", "https://gardenfeast.com.au", "nursery@gardenfeast.com.au", "03 9741 3100", "garden-feast"),
    ("Little Espresso", "cafes", "Point Cook", "", "littleespresso@outlook.com", "03 8386 7241", "little-espresso"),
    ("Little Growling Cafe", "cafes", "Tarneit", "https://littlegrowlingcafe.com.au", "littlegrowlingcafe@gmail.com", "0404 311 833", "little-growling-cafe"),
    ("Little Miss Violet", "cafes", "Point Cook", "", "littlemissvioletcafe@gmail.com", "03 8353 8630", "little-miss-violet"),
    ("Notorious Espresso", "cafes", "Werribee", "https://notoriousespresso.com.au", "hello@notoriousesp.com", "0432 098 070", "notorious-espresso"),
    ("Sons of Manor", "cafes", "Manor Lakes", "https://sonsofmanor.com.au", "info@sonsofmanor.com.au", "03 7036 6965", "sons-manor"),
    ("The South Corner", "cafes", "Werribee", "https://www.thesouthcorner.cafe", "info@thesouthcorner.cafe", "03 9741 5142", "south-corner"),
    ("Wolf on Watton", "cafes", "Werribee", "https://wolfonwatton.com.au", "hello@wolfonwatton.com.au", "", "wolf-watton"),
    ("Village Cantina Werribee", "dining", "Werribee", "", "hola@villagecantina.com.au", "03 9974 2959", "village-cantina-werribee"),
]


def main():
    out = []
    for r in json.loads((HERE / "prospect_results.json").read_text()):
        if r.get("email"):
            out.append({"business_name": r["name"], "category": r["category"], "suburb": r["suburb"], "website": r["website"],
                        "email": r["email"], "phone": "", "source_url": r["source"]})
    for name, cat, suburb, site, email, phone, slug in VISIT_WERRIBEE:
        out.append({"business_name": name, "category": cat, "suburb": suburb, "website": site, "email": email,
                    "phone": phone, "source_url": VW + slug})
    emails = [p["email"] for p in out]
    assert len(emails) == len(set(emails)), "duplicate emails"
    (HERE.parent / "prospects_seed.json").write_text(json.dumps(out, indent=1))
    print(len(out), "prospects written")


if __name__ == "__main__":
    main()
