import DOMPurify from "dompurify";
import { marked } from "marked";

const inputPrompt = document.body.querySelector("#user-input");
const buttonPrompt = document.body.querySelector("#button-prompt");
const buttonReset = document.body.querySelector("#button-reset");
const elementResponse = document.body.querySelector("#response");
const elementResponseList = document.body.querySelector("#list-reponse");
const elementLoading = document.body.querySelector("#loading");
const elementError = document.body.querySelector("#error");

let capabilities;

let session = {
  main: null,
  location: null,
  input: null,
};

let categoryPrompt;
let locationPrompt;
let systemPrompt;

//let arrayResponseTemplate;
//let responseJSONSchemaObj;

let alltext = "";
let locationText = "";
let location = {
  name: null,
  lat: null,
  lon: null,
  minLat: null,
  maxLat: null,
  minLon: null,
  maxLon: null,
};

const earthRadius = 6371; // Earth radius in km

async function loadFile(filePath) {
  try {
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const text = await response.text();
    return text;
  } catch (error) {
    console.error("Failed to load file:", error);
    return null;
  }
}

async function getCoordinates() {
  if (!location || !location.name) {
    console.error("Location name not provided.");
    return null;
  }

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    location.name
  )}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.length > 0) {
      location.lat = parseFloat(data[0].lat);
      location.lon = parseFloat(data[0].lon);
      const latDiff = (100 / earthRadius) * (180 / Math.PI);
      const lonDiff =
        ((100 / earthRadius) * (180 / Math.PI)) /
        Math.cos((parseFloat(data[0].lat) * Math.PI) / 180);
      location.minLat = parseFloat(data[0].lat) - latDiff;
      location.maxLat = parseFloat(data[0].lat) + latDiff;
      location.minLon = parseFloat(data[0].lon) - lonDiff;
      location.maxLon = parseFloat(data[0].lon) + lonDiff;
    } else {
      console.error(`No coordinates found for ${location}`);
    }
  } catch (error) {
    console.error(`Error fetching coordinates for ${location}:`, error);
  }
}

async function runPrompt(type, prompt, retries = 5) {
  try {
    if (!session) {
      await initDefaults();
      console.log("All Models Loaded");
    }
    console.log(`Running ${type} model...`);
    console.log("Prompt:", prompt.slice(0, 100) + "...");

    let response = null;
    switch (type) {
      case "main":
        !alltext ?? sendMessageToActiveTab();
        response = await session.main.prompt(prompt);
        // response = await session.prompt(prompt, {
        //   responseJSONSchema: responseJSONSchemaObj,
        // });
        break;
      case "location":
        response = await session.location.prompt(prompt);
        // response = await session.prompt(prompt, {
        //   responseJSONSchema: arrayResponseTemplate,
        // });
        break;
      case "category":
        console.log("Category model is thinking...");
        response = await session.input.prompt(
          "Create categories for:" + prompt
        );
        console.log("Category model replied");
        break;

      default:
        showError("Invalid model type.");
        return;
    }
    return response;
  } catch (error) {
    if (error.name === "NotSupportedError" && retries > 0) {
      console.log(`Retrying... Attempts left: ${retries - 1}`);
      await runPrompt(type, prompt, retries - 1); // Retry with one less attempt
    } else {
      console.error("Error classifying categories:", error);
      hide(elementLoading);
      showError(error);
    }
  }
}

async function reset() {
  if (session) {
    session.main?.destroy();
    session.input?.destroy();
  }
  session = null;
}

async function loadModels() {
  const params = {
    initialPrompts: [],
    temperature: capabilities.defaultTemperature,
    topK: capabilities.defaultTopK,
  };

  if (!session.main) {
    session.main = await ai.languageModel.create({
      ...params,
      systemPrompt: systemPrompt,
    });
  }
  if (!session.location) {
    session.location = await ai.languageModel.create({
      ...params,
      systemPrompt: locationPrompt,
    });
  }
  if (!session.input) {
    session.input = await ai.languageModel.create({
      ...params,
      systemPrompt: categoryPrompt,
    });
  }

  if (!alltext && !locationText) {
    await sendMessageToActiveTab();
  }

  // if (alltext) {
  //   console.log("Getting activities ready...");
  //   activities = await runPrompt("main", alltext);
  //   console.log(activities);
  // }
  if (locationText) {
    location.name = await runPrompt("location", locationText);
    await getCoordinates();
    console.log(location);
  }
}

async function initDefaults() {
  if (!ai) {
    showResponse("Error: chrome.aiOriginTrial not supported in this browser");
    return;
  }
  capabilities = await ai.languageModel.capabilities();

  if (capabilities.available === "after-download") {
    console.log("Model is not yet available, downloading...");
    await ai.languageModel.create({
      monitor(m) {
        m.addEventListener("downloadprogress", (e) => {
          console.log(`Downloaded ${e.loaded * 100}%`);
        });
      },
    });
    capabilities = await ai.languageModel.capabilities();
  }
  if (capabilities.available !== "readily") {
    showResponse(
      `Model not yet available (current state: "${capabilities.available}")`
    );
    return;
  }
  console.log("Getting system prompts ready...");
  categoryPrompt = await loadFile("categorySysPrompt.txt");
  locationPrompt = await loadFile("mainLocationSysPrompt.txt");
  systemPrompt = await loadFile("systemPrompt.txt");

  // arrayResponseTemplate = new ai.AILanguageModelResponseSchema({
  //   type: "array",
  //   items: {
  //     type: "string",
  //   },
  // });
  // responseJSONSchemaObj = new ai.AILanguageModelResponseSchema({
  //   type: "object",
  //   properties: {
  //     landmarks: { type: "array", items: { type: "string" } },
  //     monuments: { type: "array", items: { type: "string" } },
  //     museums: { type: "array", items: { type: "string" } },
  //     parks: { type: "array", items: { type: "string" } },
  //     historical_sites: { type: "array", items: { type: "string" } },
  //     scenic_viewpoints: { type: "array", items: { type: "string" } },
  //     local_restaurants: { type: "array", items: { type: "string" } },
  //   },
  //   additionalProperties: false,
  // });

  // console.log("Response schema:", responseJSONSchemaObj);

  await loadModels(capabilities);
}

function treatResponse(response) {
  if (!response) return null;

  if (typeof response === "string") {
    response = response.replace(/```json|```/g, "").trim();

    try {
      response = JSON.parse(response);
    } catch (error) {
      console.warn("Response is not valid JSON, returning false");
      return false;
    }
  }

  if (typeof response === "object" && response !== null) {
    for (const key in response) {
      if (typeof response[key] === "string") {
        response[key] = response[key].replace(/<\/?[^>]+(>|$)/g, "").trim();
      }
    }
  }

  return response;
}

function createPlaceCard(place) {
  const card = document.createElement("div");
  card.className = `place-card ${place.selected ? "place-card--selected" : ""}`;
  card.dataset.id = place.id;

  card.innerHTML = `
    <h3 class="place-card__name">${place.name}</h3>
    <p class="place-card__address">${place.address}</p>
    <button class="place-card__button">${
      place.selected ? "Deselect" : "Select"
    }</button>
  `;

  const button = card.querySelector(".place-card__button");
  button.addEventListener("click", () => {
    place.selected = !place.selected;
    card.classList.toggle("place-card--selected", place.selected);
    button.textContent = place.selected ? "Deselect" : "Select";
  });

  return card;
}

async function searchPlace(place) {
  let url = `https://nominatim.openstreetmap.org/search?addressdetails=1&format=json&limit=1&q=${encodeURIComponent(
    place
  )}`;

  if (location?.lat && location?.lon) {
    url = `https://nominatim.openstreetmap.org/search?addressdetails=1&format=json&limit=1&q=${encodeURIComponent(
      place
    )}&viewbox=${location.minLon},${location.minLat},${location.maxLon},${
      location.maxLat
    }&bounded=1`;
  }
  console.log(url);
  try {
    const response = await fetch(url);
    const data = await response.json();
    console.log(data);

    if (data.length > 0) {
      return createPlaceCard({
        id: data[0].place_id,
        name: data[0].name || place,
        address: data[0].address
          ? (data[0].address.city ? `${data[0].address.city}, ` : "") +
            (data[0].address.postcode ? `${data[0].address.postcode}, ` : "") +
            (data[0].address.country ? data[0].address.country : "")
          : "N/A",
        coordinates: {
          lat: data[0].lat,
          lng: data[0].lon,
        },
        selected: true,
      });
    }
  } catch (error) {
    console.error(`Error searching for ${place}:`, error);
  }
  return null;
}

async function processPlaces(response) {
  const results = [];
  showResponse("");
  for (const [category, places] of Object.entries(response)) {
    if (places.length === 0) continue;

    const title = category
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());

    const section = document.createElement("section");
    section.className = "category-title";
    const titleElement = document.createElement("h3");
    titleElement.innerText = title;
    section.appendChild(titleElement);

    const categoryData = { title, places: [] };

    for (const place of places) {
      const details = await searchPlace(place);
      if (details) {
        section.appendChild(details);
        categoryData.places.push(details);
        console.log(`Found: ${place}`);
      } else {
        console.log(`Not Found: ${place}`);
      }
    }

    elementResponseList.appendChild(section);
    results.push(categoryData);
  }
  return results;
}

async function classifyAndProcess(categorizedUserInput, retries = 3) {
  if (!alltext) {
    sendMessageToActiveTab();
  }

  // Run the main prompt
  const response = await runPrompt(
    "main",
    `You must return a valid JSON object. ${
      !categorizedUserInput
        ? `Find activities in: ${alltext}. `
        : `Keep these categories in mind: ${categorizedUserInput}. Find the activities belonging to the categories in: ${alltext}. Make sure the categories are the following: ${categorizedUserInput}. `
    }Return ONLY a JSON object with properly formatted keys and values, nothing else.`
  );
  const treatedResponse = treatResponse(response);

  if (!treatedResponse) {
    if (retries > 0) {
      console.log(
        `Invalid JSON response. Retrying... Attempts left: ${retries - 1}`
      );
      await classifyAndProcess(categorizedUserInput, retries - 1);
      return;
    } else {
      throw new Error("Maximum retries reached. Response is not valid JSON.");
    }
  }

  console.log(treatedResponse);
  await processPlaces(treatedResponse);
}

async function categorizeInput(userInput, retries = 3) {
  let categorizedUserInput = null;

  console.log(userInput);
  const categoryResponse = await runPrompt("category", userInput);
  if (!categoryResponse) {
    clear(elementError);
    showResponse("No categories identified. Finding all activities...");
  } else {
    categorizedUserInput = categoryResponse?.trim();
    showResponse(
      "Looking for activities in the following categories: " +
        categorizedUserInput
    );
  }
  show(elementLoading);

  console.log(categorizedUserInput);

  await classifyAndProcess(categorizedUserInput);
}

initDefaults();

async function sendMessageToActiveTab(retries = 5, delay = 1000) {
  if (retries <= 0) {
    console.log("Max retries reached. Exiting.");
    return;
  }

  const tabs = await new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError));
      } else {
        resolve(tabs);
      }
    });
  });

  if (!tabs.length) {
    console.log("No active tab found.");
    return;
  }

  console.log("Sending Message");
  const response = await new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(
      tabs[0].id,
      { method: "getText" },
      function (response) {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError));
        } else {
          resolve(response);
        }
      }
    );
  });

  if (response && response.method === "getText") {
    alltext = response.data;
    locationText = response.locationText;
  } else {
    console.log(`Retrying... (${retries - 1} retries left)`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    await sendMessageToActiveTab(retries - 1, delay);
  }
}

sendMessageToActiveTab();

inputPrompt.addEventListener("input", () => {
  if (inputPrompt.value.trim() && session) {
    buttonPrompt.removeAttribute("disabled");
  } else {
    buttonPrompt.setAttribute("disabled", "");
  }
});

buttonReset.addEventListener("click", () => {
  inputPrompt.value = "";
  clear(elementResponse);
  clear(elementResponseList);
  hide(elementLoading);
  hide(elementError);
  hide(elementResponse);
  hide(elementResponseList);
  reset();
  buttonReset.setAttribute("disabled", "");
});

buttonPrompt.addEventListener("click", async () => {
  const userInput = inputPrompt.value.trim();
  clear(elementResponse);
  clear(elementResponseList);
  showLoading();
  if (userInput === "" || userInput === null || userInput === "all") {
    await classifyAndProcess();
    return;
  }
  await categorizeInput(userInput);
});

function showLoading() {
  buttonReset.removeAttribute("disabled");
  hide(elementResponse);
  hide(elementError);
  show(elementLoading);
}

function showResponse(response) {
  hide(elementLoading);
  show(elementResponse);
  elementResponse.innerHTML = DOMPurify.sanitize(marked.parse(response));
}

function showError(error) {
  show(elementError);
  hide(elementResponse);
  hide(elementLoading);
  elementError.textContent = error;
}

function show(element) {
  element.removeAttribute("hidden");
}

function hide(element) {
  element.setAttribute("hidden", "");
}

function clear(element) {
  element.innerHTML = "";
}
