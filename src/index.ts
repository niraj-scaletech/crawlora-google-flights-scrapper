import { apikey, sequence_id, showBrowser } from "./config";
import moment from 'moment';  // Import moment.js
import { browser } from "@crawlora/browser";

export default async function ({
  departureCity,
  arrivalCity,
  departureDate
}: {
  departureCity: string;
  arrivalCity: string;
  departureDate: string;
}) {

  await browser(async ({ page, wait, output, debug }) => {
    try {
      let formattedDate: string;
      formattedDate = parseDate(departureDate);
      debug(formattedDate);

      await page.goto('https://www.google.com/travel/flights?gl=IN&hl=en', {
        waitUntil: 'networkidle2',
      });
      await wait(2)

      await page.waitForSelector('.VfPpkd-TkwUic[aria-haspopup="listbox"]', { timeout: 60000 });
      await page.click('.VfPpkd-TkwUic[aria-haspopup="listbox"]');
      await page.click('li[data-value="2"]');
      await wait(1)

      await page.click('input[aria-label="Where from?"]', { clickCount: 3 });
      await page.keyboard.type(departureCity, { delay: 100 });
      await page.keyboard.press('Enter');
      await wait(1)

      await page.click('input[placeholder="Where to?"]');
      await page.keyboard.type(arrivalCity, { delay: 100 });
      await page.keyboard.press('Enter');
      await wait(1);

      await page.click('input[placeholder="Departure"]');
      await page.keyboard.type(formattedDate, { delay: 100 });
      await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');
      await wait(2);

      await page.waitForSelector('button[aria-label="Search"]');
      await page.click('button[aria-label="Search"]');
      await wait(5)

      // Wait for the more flights button to appear and then click it
      await page.waitForSelector('button[jsname="ornU0b"]');
      await page.click('button[jsname="ornU0b"]');
      await wait(5)

      await page.waitForSelector('.pIav2d');

      const flightData = await page.evaluate(() => {
        const flightElements = Array.from(document.querySelectorAll('.pIav2d'));

        return flightElements.map(flight => {
          const departureTime = flight.querySelector('[aria-label^="Departure time:"]')?.textContent?.trim() || 'No departure time';
          const arrivalTime = flight.querySelector('[aria-label^="Arrival time:"]')?.textContent?.trim() || 'No arrival time';
          const airline = flight.querySelector('.sSHqwe.tPgKwe.ogfYpf')?.textContent?.trim() || 'No airline';
          const duration = flight.querySelector('[aria-label^="Total duration"]')?.textContent?.trim() || 'No total duration';
          const stops = flight.querySelector('.BbR8Ec .ogfYpf[aria-label*="stops flight"]')?.textContent?.trim() || 'No stops';
          const co2Emissions = flight.querySelector('.PtgtFe')?.textContent?.trim() || 'No co2 emission data';
          const price = flight.querySelector('.YMlIz.FpEdX span')?.textContent?.trim() || 'No price';

          const layovers: string[] = [];

          // Get all layover elements
          let layoverElements = flight.querySelectorAll('.BbR8Ec .sSHqwe[aria-label*="Layover"]');

          layoverElements.forEach(el => {
            // Extract airport names from 'span.eoY5cb' and push them into the layovers array
            Array.from(el.querySelectorAll('span.eoY5cb')).forEach(span => {
              const layover = span.textContent?.trim();
              if (layover) {
                layovers.push(layover);
              }
            });
          });

          return {
            departureTime,
            arrivalTime,
            airline,
            duration,
            stops,
            co2Emissions,
            price,
            layovers: layovers.join(', ')
          };
        });
      });

      debug(`started submitting flight data`)

      await Promise.all(flightData.map(async (data: any, index: number) => {
        await output.create({
          sequence_id, sequence_output: {
            DepartureTime: data.departureTime,
            ArrivalTime: data.arrivalTime,
            Airline: data.airline,
            Duration: data.duration,
            Stops: data.stops,
            Co2Emissions: data.co2Emissions,
            Price: data.price,
            Layovers: data.layovers,
            ResultNumber: index + 1
          }
        })
      }))

      debug(`submitted flight data`)
      await wait(2)
    } catch (error) {
      const e = error as Error;
      debug('error :>> ', error);
      throw new Error(e.message)
    }
  }, { showBrowser, apikey })

}


function parseDate(dateString: string): string {
  dateString = dateString.trim().replace(/[-/.]/g, ' '); // Replace -, /, . with space

  const regex = /^\d{2} \d{2} \d{4}$/;

  if (!regex.test(dateString)) {
    throw new Error("Invalid date format. Please use dd-mm-yyyy.");
  }

  const parsedDate = moment(dateString, "DD MM YYYY", true);

  if (parsedDate.isValid()) {
    return parsedDate.format("YYYY-MM-DD");
  } else {
    throw new Error("Invalid date format");
  }
}
