PLATFORM_TO_CONTINENT: dict[str, str] = {
    "na1": "americas",
    "br1": "americas",
    "la1": "americas",
    "la2": "americas",
    "oc1": "americas",
    "euw1": "europe",
    "eun1": "europe",
    "tr1": "europe",
    "ru": "europe",
    "kr": "asia",
    "jp1": "asia",
    "ph2": "sea",
    "sg2": "sea",
    "th2": "sea",
    "tw2": "sea",
    "vn2": "sea",
}

def continent_for_platform(platform: str) -> str:
    try:
        return PLATFORM_TO_CONTINENT[platform]
    except KeyError:
        raise ValueError(
            f"Unknown platform {platform!r}, expected one of {sorted(PLATFORM_TO_CONTINENT)}"
        ) from None
