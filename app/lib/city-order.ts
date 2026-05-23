// Şehirleri öncelikli sırada döndürür: İstanbul, Ankara, İzmir önce,
// gerisi alfabetik (Türkçe locale-aware).
// turkish_cities zaten name ile çekilir; bu fonksiyon öncelikli üçü öne alır.

type CityLike = { id: number; name: string };

// Öncelikli şehirler (sırayla)
const PRIORITY_CITIES = ["İstanbul", "Ankara", "İzmir"];

export function orderCities<T extends CityLike>(cities: T[]): T[] {
  const priority: T[] = [];
  const rest: T[] = [];

  for (const city of cities) {
    const idx = PRIORITY_CITIES.indexOf(city.name);
    if (idx !== -1) {
      priority[idx] = city; // doğru sıraya yerleştir
    } else {
      rest.push(city);
    }
  }

  // priority dizisinde boşluk olmasın (örn. İzmir DB'de yoksa) — filtrele
  const cleanPriority = priority.filter(Boolean);

  // Geri kalanı Türkçe alfabetik sırala
  rest.sort((a, b) => a.name.localeCompare(b.name, "tr"));

  return [...cleanPriority, ...rest];
}