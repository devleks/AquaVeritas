from dataclasses import dataclass


@dataclass
class Location:
    id: str
    name: str
    lat: float
    lon: float
    description: str
    expected_water_status: str
    category: str           # shrinkage | flooding | mixed
    baseline_date: str      # YYYY-MM-DD  reference "normal" period


LOCATIONS: list[Location] = [
    # ── Chronic shrinkage ────────────────────────────────────────────────────
    Location(
        id="lake_chad",
        name="Lake Chad",
        lat=12.95,
        lon=14.25,
        description=(
            "Lake Chad, West Africa. Once one of Africa's largest lakes, it has lost "
            "approximately 90% of its surface area since the 1960s due to agricultural "
            "water extraction, reduced rainfall, and population growth. Over 30 million "
            "people depend on it. Coordinate is at the southeastern shore of the southern "
            "pool, where open water, exposed mudflats, and irrigated agriculture all meet."
        ),
        expected_water_status="Lake should show open water in the southern basin. "
            "Significant shrinkage is expected versus 1970s baseline.",
        category="shrinkage",
        baseline_date="2000-01-01",
    ),
    Location(
        id="aral_sea",
        name="Aral Sea South Basin",
        lat=43.80,
        lon=59.10,
        description=(
            "Aral Sea Southern Basin, Uzbekistan/Kazakhstan. Once the world's fourth "
            "largest lake, diverted for Soviet cotton irrigation from the 1960s. The "
            "southern basin is nearly completely dry. Coordinate is at the Amu Darya "
            "delta wetland system where the last remaining water, exposed salt flat "
            "shoreline, and the surrounding arid landscape meet within a single 15km tile."
        ),
        expected_water_status="Minimal or no open water expected. Salt flats and "
            "exposed lakebed dominate. Any water present is a recovery signal.",
        category="shrinkage",
        baseline_date="2000-01-01",
    ),
    Location(
        id="lake_urmia",
        name="Lake Urmia",
        lat=37.60,
        lon=46.00,
        description=(
            "Lake Urmia, northwestern Iran. A hypersaline lake that has lost approximately "
            "80% of its volume since the 1970s due to upstream dam construction and "
            "agricultural water diversion. Coordinate is at the southeastern shore where "
            "pink halophyte salt flats, open hypersaline water, and irrigated wheat fields "
            "are all visible within the 15km tile."
        ),
        expected_water_status="Significantly reduced water extent. Salt flats and pink/red "
            "halophyte vegetation visible at margins. Some seasonal variation.",
        category="shrinkage",
        baseline_date="2000-01-01",
    ),
    Location(
        id="dead_sea",
        name="Dead Sea",
        lat=31.80,
        lon=35.55,
        description=(
            "Dead Sea, Jordan/Israel/Palestine. The lowest point on Earth, dropping "
            "approximately 1 metre per year due to water diversion from the Jordan River "
            "and mineral extraction industries. Coordinate is at the northern Dead Sea "
            "where the hypersaline lake, the receding shoreline with exposed salt flat, "
            "the Jordan River delta, and Israeli/Jordanian agricultural fields (dates, "
            "vegetables) are all captured within the 15km tile."
        ),
        expected_water_status="Deep blue hypersaline water, but shoreline clearly receding. "
            "White salt flats visible on exposed former lakebed.",
        category="shrinkage",
        baseline_date="2000-01-01",
    ),
    Location(
        id="salton_sea",
        name="Salton Sea",
        lat=33.05,
        lon=-115.70,
        description=(
            "Salton Sea, California, USA. California's largest lake by surface area, "
            "fed almost entirely by agricultural runoff from Imperial Valley. Shrinking "
            "rapidly as irrigation efficiency reduces inflow. Coordinate is at the "
            "southeastern shore where the receding saline lake, exposed white salt playa, "
            "and intensive Imperial Valley agriculture (alfalfa, vegetables) are all "
            "visible in the same 15km tile."
        ),
        expected_water_status="Shallow saline lake with clearly exposed salt/playa flats "
            "around the perimeter. Agricultural fields dominate the buffer zone.",
        category="shrinkage",
        baseline_date="2000-01-01",
    ),

    # ── Flooding / extreme seasonal variation ────────────────────────────────
    Location(
        id="lake_victoria",
        name="Lake Victoria",
        lat=0.05,
        lon=34.20,
        description=(
            "Lake Victoria, East Africa (Uganda/Kenya/Tanzania). Africa's largest lake "
            "by area. Experienced historic flooding in 2020 when water levels rose over "
            "1.2m above normal, inundating lakeshore communities. Coordinate is on the "
            "Kenyan northwestern shore near Kisumu, where the lake margin, inundated "
            "wetlands, and smallholder maize/sorghum farms are all within 15km."
        ),
        expected_water_status="Large open water body. Shoreline variation between flood "
            "and recession seasons is significant. Watch for inundated margin vegetation.",
        category="flooding",
        baseline_date="2018-01-01",
    ),
    Location(
        id="tonle_sap",
        name="Tonle Sap",
        lat=13.05,
        lon=103.85,
        description=(
            "Tonle Sap Lake, Cambodia. Southeast Asia's largest freshwater lake and a "
            "critical fishery. Undergoes extreme seasonal variation — expanding up to 3x "
            "in size during monsoon season. Coordinate is at the northern shore where "
            "the lake edge, flooded forest fringe, and surrounding rice paddies are all "
            "visible within the 15km tile."
        ),
        expected_water_status="Highly seasonal — large open water in Oct-Nov (flood peak), "
            "much smaller in April-May (dry season). Surrounded by flooded forest and rice.",
        category="flooding",
        baseline_date="2018-01-01",
    ),
    Location(
        id="okavango",
        name="Okavango Delta",
        lat=-19.80,
        lon=23.10,
        description=(
            "Okavango Delta, Botswana. UNESCO World Heritage site. An inland river delta "
            "that floods seasonally as Angolan rains arrive via the Okavango River. "
            "Coordinate is at the southeastern edge of the delta where the flood front, "
            "permanent channels, seasonal grassland, and cattle grazing land meet."
        ),
        expected_water_status="Seasonal flooding creates a mosaic of water channels and "
            "islands. Dry season shows grassland and scrub. Flood extent varies year to year.",
        category="flooding",
        baseline_date="2018-01-01",
    ),

    # ── Mixed / agricultural signal ──────────────────────────────────────────
    Location(
        id="po_valley",
        name="Lake Garda (Po Valley)",
        lat=45.55,
        lon=10.68,
        description=(
            "Lake Garda, northern Italy — the largest Italian lake and the primary "
            "freshwater reservoir for Po Valley irrigation. In the 2022 drought, Lake "
            "Garda dropped to historic lows, visibly exposing rock shelves and restricting "
            "water supply to surrounding agriculture. Coordinate is at the southern shore "
            "near Sirmione where the deep blue lake, the distinctive shoreline, and the "
            "surrounding Valpolicella vineyards and Po Valley crops are all visible within "
            "the 15km tile."
        ),
        expected_water_status="Mosaic of lagoon water, reed beds, and intensive agriculture. "
            "2022 drought visible as reduced lagoon extent and stressed crops.",
        category="mixed",
        baseline_date="2018-01-01",
    ),
    Location(
        id="mekong_delta",
        name="Mekong Delta",
        lat=10.05,
        lon=105.65,
        description=(
            "Mekong Delta, southern Vietnam. The rice bowl of Southeast Asia. Upstream "
            "dams in China and Laos have reduced seasonal flooding, reducing sediment "
            "delivery and freshwater flow. Coordinate is near Can Tho, the delta's "
            "largest city, where a dense network of canals, active rice paddies, and "
            "the Mekong main channel are all within the 15km tile."
        ),
        expected_water_status="Dense network of canals and rivers. Rice paddies in varying "
            "growth stages. Watch for flooded fields during wet season vs bare/dry in drought.",
        category="mixed",
        baseline_date="2018-01-01",
    ),
    Location(
        id="lake_turkana",
        name="Lake Turkana",
        lat=3.50,
        lon=36.05,
        description=(
            "Lake Turkana, Kenya/Ethiopia border. World's largest permanent desert lake. "
            "The Omo River provides 90% of its inflow. Since the Gibe III dam began "
            "operation in 2015, seasonal flooding has been eliminated and lake levels "
            "are declining. Coordinate is on the western shore where the green-tinted "
            "lake, rocky shoreline, and arid pastoral grazing land are all visible."
        ),
        expected_water_status="Large greenish-blue lake (algae give it a distinct colour). "
            "Level decline noticeable post-2015. Surrounding land is arid/semi-arid.",
        category="mixed",
        baseline_date="2018-01-01",
    ),
    Location(
        id="lake_titicaca",
        name="Lake Titicaca",
        lat=-15.85,
        lon=-70.02,
        description=(
            "Lake Titicaca, Peru/Bolivia border. World's highest navigable lake at 3,812m. "
            "Declining water levels driven by Andean glacier retreat reducing inflows and "
            "increased evaporation from warming temperatures. Coordinate is on the "
            "northwestern shore near Puno, where the deep blue lake, reed-covered margins, "
            "and quinoa/potato terraces on the altiplano are all within 15km."
        ),
        expected_water_status="Deep blue high-altitude lake. Clear water with visible depth. "
            "Level variations affect reed-covered margins. Surrounding altiplano is farmed.",
        category="mixed",
        baseline_date="2018-01-01",
    ),
]

LOCATIONS_BY_ID: dict[str, Location] = {loc.id: loc for loc in LOCATIONS}
