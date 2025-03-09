import DOMPurify from "dompurify";
import { marked } from "marked";

const inputPrompt = document.body.querySelector("#user-input");
const buttonPrompt = document.body.querySelector("#button-prompt");
const buttonReset = document.body.querySelector("#button-reset");
const elementResponse = document.body.querySelector("#response");
const elementResponseList = document.body.querySelector("#list-reponse");
const elementLoading = document.body.querySelector("#loading");
const elementError = document.body.querySelector("#error");

const MAX_CHARS = 2048;
let capabilities;
let session = {
  main: null,
  location: null,
  input: null,
};

let alltext = "";
let categorizedUserInput = "";

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

async function runPrompt(sessionModel, prompt, retry = true) {
  try {
    if (!session[sessionModel] && sessionModel != "main") {
      await initDefaults();
      console.log("Model Loaded");
    }
    if (sessionModel === "main") {
      const response = await session[sessionModel].prompt(prompt);
      reset(sessionModel);
      return response;
    }
    return await session[sessionModel].prompt(prompt);
  } catch (e) {
    if (retry) {
      console.log("Retrying...");
      reset(sessionModel);
      return runPrompt(sessionModel, prompt, false);
    }
    throw e;
  }
}

async function reset(sessionModel) {
  if (session[sessionModel]) {
    session[sessionModel].destroy();
  }
  session[sessionModel] = null;
}

async function mainLoadModel(categories) {
  let systemPrompt = await loadFile("systemPrompt.txt");

  if (!categories) {
    showError("No categories found.");
    return;
  }
  const modifiedPrompt = systemPrompt.replaceAll("{{userInput}}", categories);
  console.log(modifiedPrompt);

  const params = {
    initialPrompts: [],
    temperature: capabilities.defaultTemperature,
    topK: capabilities.defaultTopK,
  };

  if (!session.main) {
    console.log("Main Model loading...");
    session.main = await ai.languageModel.create({
      ...params,
      systemPrompt: modifiedPrompt,
    });
    console.log("Model is ready");
  }
}

async function loadModels() {
  let categoryPrompt = await loadFile("categorySysPrompt.txt");
  let locationPrompt = await loadFile("mainLocationSysPrompt.txt");

  const params = {
    initialPrompts: [],
    temperature: capabilities.defaultTemperature,
    topK: capabilities.defaultTopK,
  };

  if (!session.location) {
    console.log("Location Model loading...");
    session.location = await ai.languageModel.create({
      ...params,
      systemPrompt: locationPrompt,
    });
    console.log("Model is ready");
  }
  if (!session.input) {
    console.log("Input Model loading...");
    session.input = await ai.languageModel.create({
      ...params,
      systemPrompt: categoryPrompt,
    });
    console.log("Model is ready");
  }
}

async function initDefaults() {
  if (!ai) {
    showResponse("Error: chrome.aiOriginTrial not supported in this browser");
    return;
  }
  capabilities = await ai.languageModel.capabilities();
  if (capabilities.available !== "readily") {
    showResponse(
      `Model not yet available (current state: "${capabilities.available}")`
    );
    return;
  }
  await loadModels(capabilities);
}

function extractDataFromResponse(response) {
  const listItems = [];
  const regexPatterns = [
    /- (.+?)(?=\n|$)/g, // Matches list items starting with '- '
    /\* (.+?)(?=\n|$)/g, // Matches list items starting with '* '
    /\d+\. (.+?)(?=\n|$)/g, // Matches numbered list items
  ];

  regexPatterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(response)) !== null) {
      listItems.push(match[1].trim());
    }
  });

  return listItems;
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

  elementResponseList.appendChild(card);
}

async function searchPlace(place) {
  const url = `https://nominatim.openstreetmap.org/search?addressdetails=1&format=json&limit=1&q=${encodeURIComponent(
    place
  )}`;

  try {
    const response = await fetch(url);
    console.log(response);
    const data = await response.json();
    console.log(data);

    if (data.length > 0) {
      createPlaceCard({
        id: data[0].place_id,
        name: data[0].name,
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

async function processPlaces(places) {
  const results = [];
  for (const place of places) {
    const details = await searchPlace(place);
    if (details) {
      results.push(details);
      console.log(`Found: ${details.name}`, details);
    } else {
      console.log(`Not Found: ${place}`);
    }
  }
  return results;
}

initDefaults();

chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  console.log("Sending Message");
  chrome.tabs.sendMessage(
    tabs[0].id,
    { method: "getText" },
    function (response) {
      if (response && response.method === "getText") {
        alltext = response.data;
      } else {
        console.error("Error getting text:", chrome.runtime.lastError);
        if (chrome.runtime.lastError) {
          console.error(
            "Last Error Message : ",
            chrome.runtime.lastError.message
          );
        }
      }
    }
  );
});

inputPrompt.addEventListener("input", () => {
  if (inputPrompt.value.trim() && session) {
    buttonPrompt.removeAttribute("disabled");
  } else {
    buttonPrompt.setAttribute("disabled", "");
  }
});

buttonReset.addEventListener("click", () => {
  hide(elementLoading);
  hide(elementError);
  hide(elementResponse);
  reset();
  buttonReset.setAttribute("disabled", "");
});

buttonPrompt.addEventListener("click", async () => {
  const userInput = inputPrompt.value.trim();

  showLoading();
  try {
    console.log(userInput);
    const categoryResponse = await runPrompt("input", userInput);

    categorizedUserInput = categoryResponse.trim();

    if (categorizedUserInput === "No categories found.") {
      showError("No valid categories found in your input.");
      hide(elementLoading);
      return;
    }
    console.log(categorizedUserInput);
    await mainLoadModel(categorizedUserInput);
    let response = "";
    if (!alltext) {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { method: "getText" },
          async function (response) {
            if (response && response.method === "getText") {
              alltext = response.data;

              response = await runPrompt(session.main, alltext);
            } else {
              console.error("Error getting text:", chrome.runtime.lastError);
              if (chrome.runtime.lastError) {
                console.error(
                  "Last Error Message : ",
                  chrome.runtime.lastError.message
                );
              }
              hide(elementLoading);
              showError("Error getting text from the page.");
            }
          }
        );
      });
    } else {
      // Run the main prompt
      response = await runPrompt("main", alltext);
    }
    const listItems = extractDataFromResponse(response);
    console.log(listItems);
    await processPlaces(listItems);
    showResponse(response);
  } catch (categoryError) {
    console.error("Error classifying categories:", categoryError);
    hide(elementLoading);
    showError(e);
  }
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
