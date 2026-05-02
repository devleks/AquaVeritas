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
        lat=13.47,
        lon=14.00,
        description=(
            "Lake Chad, West Africa. Once one of Africa's largest lakes, it has lost "
            "approximately 90% of its surface area since the 1960s due to agricultural "
            "water extraction, reduced rainfall, and population growth. Over 30 million "
            "people depend on it. The active southern shoreline shows the most change."
        ),
        expected_water_status="Lake should show open water in the southern basin. "
            "Significant shrinkage is expected versus 1970s baseline.",
        category="shrinkage",
        baseline_date="2000-01-01",
    ),
    Location(
        id="aral_sea",
        name="Aral Sea East Basin",
        lat=45.50,
        lon=59.60,
        description=(
            "Aral Sea Eastern Basin, Kazakhstan/Uzbekistan. Once the world's fourth "
            "largest lake, diverted for Soviet cotton irrigation from the 1960s. The "
            "eastern basin dried almost completely by 2014. Coordinates point to the "
            "last remnant water on the eastern side."
        ),
        expected_water_status="Minimal or no open water expected. Salt flats and "
            "exposed lakebed dominate. Any water present is a recovery signal.",
        category="shrinkage",
        baseline_date="2000-01-01",
    ),
    Location(
        id="lake_urmia",
        name="Lake Urmia",
        lat=37.70,
        lon=45.50,
        description=(
            "Lake Urmia, northwestern Iran. A hypersaline lake that has lost approximately "
            "80% of its volume since the 1970s due to upstream dam construction and "
            "agricultural water diversion. Salt flat expansion is clearly visible from space."
        ),
        expected_water_status="Significantly reduced water extent. Salt flats and pink/red "
            "halophyte vegetation visible at margins. Some seasonal variation.",
        category="shrinkage",
        baseline_date="2000-01-01",
    ),
    Location(
        id="dead_sea",
        name="Dead Sea",
        lat=31.50,
        lon=35.50,
        description=(
            "Dead Sea, Jordan/Israel/Palestine. The lowest point on Earth, dropping "
            "approximately 1 metre per year due to water diversion from the Jordan River "
            "and mineral extraction industries. Sinkholes forming along former shorelines."
        ),
        expected_water_status="Deep blue hypersaline water, but shoreline clearly receding. "
            "White salt flats visible on exposed former lakebed.",
        category="shrinkage",
        baseline_date="2000-01-01",
    ),
    Location(
        id="salton_sea",
        name="Salton Sea",
        lat=33.33,
        lon=-115.85,
        description=(
            "Salton Sea, California, USA. California's largest lake by surface area, "
            "fed almost entirely by agricultural runoff from Imperial Valley. Shrinking "
            "rapidly as irrigation efficiency reduces inflow. Dust storms from exposed "
            "lakebed are a major public health concern."
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
        lat=-1.00,
        lon=33.00,
        description=(
            "Lake Victoria, East Africa (Uganda/Kenya/Tanzania). Africa's largest lake "
            "by area. Experienced historic flooding in 2020 when water levels rose over "
            "1.2m above normal, inundating lakeshore communities. Rapid seasonal recession "
            "followed. Subsistence farming communities on margins."
        ),
        expected_water_status="Large open water body. Shoreline variation between flood "
            "and recession seasons is significant. Watch for inundated margin vegetation.",
        category="flooding",
        baseline_date="2018-01-01",
    ),
    Location(
        id="tonle_sap",
        name="Tonle Sap",
        lat=12.50,
        lon=104.00,
        description=(
            "Tonle Sap Lake, Cambodia. Southeast Asia's largest freshwater lake and a "
            "critical fishery. Undergoes extreme seasonal variation — expanding up to 3x "
            "in size during monsoon season. Long-term shrinkage trend due to upstream "
            "Mekong dams reducing flood pulse. Rice paddies surround the lake."
        ),
        expected_water_status="Highly seasonal — large open water in Oct-Nov (flood peak), "
            "much smaller in April-May (dry season). Surrounded by flooded forest and rice.",
        category="flooding",
        baseline_date="2018-01-01",
    ),
    Location(
        id="okavango",
        name="Okavango Delta",
        lat=-19.30,
        lon=22.80,
        description=(
            "Okavango Delta, Botswana. UNESCO World Heritage site. An inland river delta "
            "that floods seasonally as Angolan rains arrive via the Okavango River. "
            "Flood pulse typically peaks June-August. Cattle farming in the buffer zone."
        ),
        expected_water_status="Seasonal flooding creates a mosaic of water channels and "
            "islands. Dry season shows grassland and scrub. Flood extent varies year to year.",
        category="flooding",
        baseline_date="2018-01-01",
    ),

    # ── Mixed / agricultural signal ──────────────────────────────────────────
    Location(
        id="po_valley",
        name="Po Valley (Po River)",
        lat=45.00,
        lon=11.00,
        description=(
            "Po River, northern Italy. The Po Valley is the most productive agricultural "
            "region in Europe. In 2022 the Po reached record low levels during a severe "
            "multi-month drought, devastating crops across the plain. The river serves as "
            "the primary irrigation source for surrounding agriculture."
        ),
        expected_water_status="Meandering river with variable width. Surrounding farmland "
            "shows intensive cultivation. 2022 drought visible as severely reduced flow.",
        category="mixed",
        baseline_date="2018-01-01",
    ),
    Location(
        id="mekong_delta",
        name="Mekong Delta",
        lat=10.00,
        lon=105.80,
        description=(
            "Mekong Delta, southern Vietnam. The rice bowl of Southeast Asia. Upstream "
            "dams in China and Laos have reduced seasonal flooding, reducing sediment "
            "delivery and freshwater flow. Saltwater intrusion from sea level rise is "
            "destroying rice paddies. Over 20 million people depend on delta agriculture."
        ),
        expected_water_status="Dense network of canals and rivers. Rice paddies in varying "
            "growth stages. Watch for flooded fields during wet season vs bare/dry in drought.",
        category="mixed",
        baseline_date="2018-01-01",
    ),
    Location(
        id="lake_turkana",
        name="Lake Turkana",
        lat=3.60,
        lon=36.10,
        description=(
            "Lake Turkana, Kenya/Ethiopia border. World's largest permanent desert lake. "
            "The Omo River provides 90% of its inflow. Since the Gibe III dam began "
            "operation in 2015, seasonal flooding has been eliminated and lake levels "
            "are declining. Pastoral and small-scale farming communities are affected."
        ),
        expected_water_status="Large greenish-blue lake (algae give it a distinct colour). "
            "Level decline noticeable post-2015. Surrounding land is arid/semi-arid.",
        category="mixed",
        baseline_date="2018-01-01",
    ),
    Location(
        id="lake_titicaca",
        name="Lake Titicaca",
        lat=-15.90,
        lon=-69.33,
        description=(
            "Lake Titicaca, Peru/Bolivia border. World's highest navigable lake at 3,812m. "
            "Declining water levels driven by Andean glacier retreat reducing inflows and "
            "increased evaporation from warming temperatures. Quinoa and potato farming "
            "communities on the margins depend on the lake for irrigation."
        ),
        expected_water_status="Deep blue high-altitude lake. Clear water with visible depth. "
            "Level variations affect reed-covered margins. Surrounding altiplano is farmed.",
        category="mixed",
        baseline_date="2018-01-01",
    ),
]

LOCATIONS_BY_ID: dict[str, Location] = {loc.id: loc for loc in LOCATIONS}
