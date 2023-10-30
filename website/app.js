let accounts = [];
let web3;
const ETHERSCAN_API_KEY = "YOUR_ETHERSCAN_API_KEY"; // Etherscan에서 받은 API 키

async function connectEthereum() {
  if (!window.ethereum && !window.web3) {
    console.log("Non-Ethereum browser detected. Consider using MetaMask.");
    updateUI(false);
    return;
  }

  if (window.ethereum) {
    web3 = new Web3(window.ethereum);

    try {
      accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      updateUI(true);
      window.ethereum.on("accountsChanged", function (_accounts) {
        accounts = _accounts;
        if (accounts.length > 0) {
          updateUI(true);
        } else {
          updateUI(false);
        }
      });
    } catch (error) {
      console.error("User denied account access:", error);
      updateUI(false);
    }
  } else if (window.web3) {
    web3 = new Web3(window.web3.currentProvider);
    accounts = await web3.eth.getAccounts();
    if (accounts && accounts.length > 0) {
      updateUI(true);
    } else {
      updateUI(false);
    }
  }
}

function disconnectEthereum() {
  accounts = [];
  if (window.ethereum) {
    window.ethereum.removeAllListeners();
  }
  updateUI(false);
}

function updateUI(isConnected) {
  if (isConnected && accounts.length > 0) {
    document.getElementById("walletButton").textContent = "Disconnect";
    const displayedAddress = `${accounts[0].substr(
      0,
      6
    )}...${accounts[0].substr(-4)}`;
    document.getElementById("connectedAddress").textContent = displayedAddress;
  } else {
    document.getElementById("walletButton").textContent = "Connect Wallet";
    document.getElementById("connectedAddress").textContent = "";
  }
}

async function issueVC() {
  const receiverAddress = document.getElementById("receiverAddress").value;
  const userName = document.getElementById("name").value;
  const userDOB = document.getElementById("dob").value;
  const studentNumber = document.getElementById("studentId").value;

  // DID 자동 생성
  const did = "did:schoolVerify:" + uuidv4();

  const vcPayload = {
    "@context": "https://www.w3.org/2018/credentials/v1",
    id: did,
    type: ["VerifiableCredential"],
    issuer: accounts[0],
    issuanceDate: new Date().toISOString(),
    credentialSubject: {
      id: did,
      name: userName,
      dateOfBirth: userDOB,
      studentNumber: studentNumber,
    },
  };

  // 서명 생성을 위해 DID를 문자열로 변환
  const message = web3.utils.sha3(JSON.stringify(vcPayload));

  try {
    // 메시지에 서명
    const signature = await web3.eth.personal.sign(message, accounts[0]);
    // 서명한 메시지를 VC에 추가
    vcPayload["proof"] = {
      type: "EcdsaSecp256k1Signature2019",
      created: new Date().toISOString(),
      proofPurpose: "assertionMethod",
      verificationMethod: accounts[0],
      jws: signature,
    };
  } catch (error) {
    console.error("Error signing the VC:", error);
    return; // 서명 중 오류가 발생하면 함수 종료
  }

  // 이 부분에서 우측 textarea에 VC 출력
  document.getElementById("issuedVC").value = JSON.stringify(
    vcPayload,
    null,
    4
  );

  const vcHash = web3.utils.sha3(JSON.stringify(vcPayload));

  const contract = new web3.eth.Contract(contractABI, contractAddress);
  contract.methods
    .mint(receiverAddress, vcHash)
    .send({ from: accounts[0] })
    .on("receipt", function (receipt) {
      console.log("VC issued successfully!", receipt);
    })
    .on("error", function (error) {
      console.error("Error issuing VC", error);
    });
}

async function createVP() {
  const jsonFileInput = document.getElementById("jsonFileInput");
  const holderAddress = document.getElementById("holderAddress").value;

  const uploadedFile = jsonFileInput.files[0];
  const reader = new FileReader();

  reader.onload = async function (e) {
    try {
      const originalData = JSON.parse(e.target.result);
      const vpPayload = {
        "@context": "https://www.w3.org/2018/credentials/v1",
        type: ["VerifiablePresentation"],
        holder: holderAddress,
        verifiableCredential: [originalData],
      };
      const message = web3.utils.sha3(JSON.stringify(vpPayload));

      try {
        // 서명 추가
        const signature = await web3.eth.personal.sign(message, accounts[0]);
        vpPayload["proof"] = {
          type: "EcdsaSecp256k1Signature2019",
          created: new Date().toISOString(),
          proofPurpose: "assertionMethod",
          verificationMethod: accounts[0],
          jws: signature,
        };

        // const vpHash = web3.utils.sha3(JSON.stringify(vpPayload));

        // const contract = new web3.eth.Contract(contractABI, contractAddress);
        // contract.methods
        //   .mint(holderAddress, vpHash)
        //   .send({ from: accounts[0] })
        //   .on("receipt", function (receipt) {
        //     console.log("VP created successfully!", receipt);
        //   })
        //   .on("error", function (error) {
        //     console.error("Error issuing VP", error);
        //   });

        // 다운로드
        const downloadButton = document.getElementById("downloadButton");
        downloadButton.style.display = "block";
        downloadButton.addEventListener("click", () => {
          const vpJSONBlob = new Blob([JSON.stringify(vpPayload)], {
            type: "application/json",
          });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(vpJSONBlob);
          a.download = "VP.json";
          a.style.display = "none";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        });
      } catch (error) {
        alert("Error signing and creating the VP: " + error.message);
      }
    } catch (error) {
      alert("Error parsing JSON file: " + error.message);
    }
  };

  reader.readAsText(uploadedFile);
}

async function signVC(vcData, address) {
  const vcString = JSON.stringify(vcData);
  const hashedVC = web3.utils.sha3(vcString);

  const signature = await web3.eth.personal.sign(hashedVC, address, ""); // 마지막 매개변수는 비밀번호: MetaMask에선 불필요

  return signature;
}

function addSignatureToVC(vc, signature) {
  vc["proof"] = {
    type: "EcdsaSecp256k1Signature",
    created: new Date().toISOString(),
    proofPurpose: "assertionMethod",
    verificationMethod: accounts[0], // 현재 Ethereum 주소
    signature: signature,
  };
  return vc;
}

function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function downloadJSON() {
  const data = document.getElementById("issuedVC").value;
  const blob = new Blob([data], { type: "application/json" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = "VC.json";

  document.body.appendChild(a);
  a.click();

  window.URL.revokeObjectURL(url);
}
//아래,위 함수 합칠 예정
function downloadVP(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

function showPage(pageId) {
  const pages = ["issueVC", "registerPage", "verifyVPPage", "createVPPage"];
  for (let id of pages) {
    if (id === pageId) {
      document.getElementById(id).style.display = "block";
      // 여기에 로직을 추가
      if (id === "register") {
        if (!accounts || accounts.length === 0) {
          alert("Please connect your Ethereum wallet first.");
          return;
        }
        const ownerAddress = accounts[0];
      }
    } else {
      document.getElementById(id).style.display = "none";
    }
  }
}

async function fetchSBTTokensByOwner(ownerAddress) {
  const GRAPH_ENDPOINT =
    "https://api.thegraph.com/subgraphs/name/YOUR_SUBGRAPH_ID_HERE"; // 여기에 실제 Subgraph ID를 넣으세요.

  const query = `
        {
            sbtTokens(where: { owner: "${ownerAddress}" }) {
                did
                proof
            }
        }
    `;

  const response = await fetch(GRAPH_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: query,
    }),
  });

  const data = await response.json();
  return data.data.sbtTokens;
}

function displaySBTTokens(tokens) {
  const transactionsTableBody = document.querySelector(
    "#transactionsTable tbody"
  );
  transactionsTableBody.innerHTML = ""; // 기존 행 삭제

  for (const token of tokens) {
    const row = transactionsTableBody.insertRow();

    const didCell = row.insertCell(0);
    didCell.textContent = token.did;

    const proofCell = row.insertCell(1);
    proofCell.textContent = token.proof;
  }
}

function registerOrg() {
  try {
    // Step 1: Get the organization name and wallet address from the user input
    const orgNameInput = document.getElementById('orgName');
    const orgName = orgNameInput.value.trim();

    // Assuming the wallet address is available in a similar manner
    // Adjust the retrieval of the wallet address as per your implementation
    const walletAddress = accounts[0]; // Or however you retrieve the current user's wallet address

    if (!orgName) {
      alert('Please enter the organization name.');
      return;
    }

    if (!walletAddress) {
      alert('No wallet address available. Please make sure you are logged in.');
      return;
    }

    // Step 2: Retrieve the existing organizations from localStorage
    const allOrgsStr = localStorage.getItem('orgInfo');
    let allOrgs = [];
    if (allOrgsStr) {
      const parsedOrgs = JSON.parse(allOrgsStr);
      // Check if parsed data is an array
      if (Array.isArray(parsedOrgs[0])) {
        allOrgs = parsedOrgs;
      } else {
        console.error('Unexpected data found in orgInfo, expected an array.', parsedOrgs);
        // Handle or report this issue as appropriate in your application
      }
    }

    // Check if the organization is already registered using a basic loop
    let orgExists = false;
    for (let i = 0; i < allOrgs.length; i++) {
      if (allOrgs[i].address === walletAddress) {
        orgExists = true;
        break; // If we find the organization, we can exit the loop early
      }
    }

    if (orgExists) {
      alert('This organization is already registered.');
      return;
    }

    // Step 3: Add the new organization
    const newOrg = {
      organization: orgName,
      address: walletAddress,
    };

    // Now, it should be safe to use the push method since allOrgs is definitely an array
    allOrgs.push(newOrg);

    // Step 4: Save the updated organizations list back to localStorage
    localStorage.setItem('orgInfo', JSON.stringify(allOrgs));

    alert('Organization registered successfully!');
    orgNameInput.value = ''; // Clear the input field after successful registration
  } catch (error) {
    console.error('An error occurred during the registration process', error);
    alert('Could not register the organization due to an unexpected error.');
  }
}

function verifyVP() {
  // TODO: Add actual verification logic here

  // For this example, we'll simply display "Verified!"
  document.getElementById("verificationResult").textContent = "Verified!";
}

function verifyOrg() {
  try {
    // Step 1: Parse the VP from the text area
    const vpTextArea = document.getElementById('vpTextArea'); // make sure the ID is correct based on your actual HTML
    const vpText = vpTextArea.value;

    // Attempt to parse the text area content as JSON
    let vp;
    try {
      vp = JSON.parse(vpText);
    } catch (error) {
      alert('Invalid VP. Please enter a valid JSON.');
      return;
    }

    // Extract the 'issuer' from the VP. This may vary based on the structure of your VP
    const issuerAddress = vp.verifiableCredential[0].issuer; // adjust based on your actual VP structure

    if (!issuerAddress) {
      alert('No issuer found in the VP.');
      return;
    }

    // Step 2: Query the local database (using localStorage in this example)
    const orgInfoStr = localStorage.getItem('orgInfo');
    const orgInfo = JSON.parse(orgInfoStr);

    // Step 3: Display the result
    const resultDisplay = document.getElementById('orgVerificationResult');

    if (orgInfo && orgInfo.address === issuerAddress) {
      // If the issuer exists, display the organization's name
      resultDisplay.textContent = `Organization: ${orgInfo.organization}`;
    } else {
      // If the issuer does not exist, display 'NONE'
      resultDisplay.textContent = 'NONE';
    }
  } catch (error) {
    console.error('An error occurred during the verification process', error);
    alert('Could not verify the organization. See console for error.');
  }
}

function banDID() {
  try {
    const didInput = document.getElementById('blacklistedDID');
    const did = didInput.value.trim();

    if (!did) {
      alert('Please enter a DID.');
      return;
    }

    // Retrieve the existing blacklist from localStorage
    const blacklistStr = localStorage.getItem('blacklist');
    const blacklist = blacklistStr ? JSON.parse(blacklistStr) : [];

    // Check if the DID is already blacklisted
    if (blacklist.includes(did)) {
      alert('This DID is already blacklisted.');
      return;
    }

    // Add the new DID to the blacklist
    blacklist.push(did);

    // Save the updated blacklist to localStorage
    localStorage.setItem('blacklist', JSON.stringify(blacklist));

    alert('DID successfully blacklisted!');
    didInput.value = ''; // Clear the input field after successful action
  } catch (error) {
    console.error('Error blacklisting DID: ', error);
    alert('Could not blacklist the DID due to an unexpected error.');
  }
}

// Global variable to store the last verified DID
let lastVerifiedDID = "";

function verifyBlacklisted() {
  try {
    // Parse the VP from the text area
    const vpTextArea = document.getElementById('vpTextArea');
    const vpText = vpTextArea.value;

    let vp;
    try {
      vp = JSON.parse(vpText);
    } catch (error) {
      alert('Invalid VP. Please enter a valid JSON.');
      return;
    }

    // Extract the 'id' from the VP
    const did = vp.verifiableCredential[0].id;

    if (!did) {
      alert('No DID found in the VP.');
      return;
    }

    // If the DID is the same as the last verified, don't proceed
    if (did === lastVerifiedDID) {
      console.log('Same DID as the last one verified. No new data to add.');
      return;
    }

    // Update the last verified DID
    lastVerifiedDID = did;

    // Retrieve the blacklist from localStorage
    const blacklistStr = localStorage.getItem('blacklist');
    const blacklist = blacklistStr ? JSON.parse(blacklistStr) : [];

    // Check if the DID is in the blacklist
    const isBlacklisted = blacklist.includes(did);

    // Reference the table and its body
    const tableRef = document.getElementById('banResult');
    const tbodyRef = tableRef.getElementsByTagName('tbody')[0];

    // Insert a row at the end of the table
    const newRow = tbodyRef.insertRow();

    // Insert cells in the row
    const cell1 = newRow.insertCell(0);
    const cell2 = newRow.insertCell(1);

    // Append the text content
    cell1.textContent = did;
    cell2.textContent = isBlacklisted ? 'Invalid' : 'Valid';

    // Optionally add style or class to the 'Invalid'/'Valid' text for better visualization
    if (isBlacklisted) {
      cell2.classList.add('invalid-status'); // Define the 'invalid-status' class in your CSS
    } else {
      cell2.classList.add('valid-status'); // Define the 'valid-status' class in your CSS
    }
  } catch (error) {
    console.error('Error verifying DID: ', error);
    alert('Could not verify the DID due to an unexpected error.');
  }
}


document.addEventListener("DOMContentLoaded", function () {
  document
    .getElementById("walletButton")
    .addEventListener("click", async function (event) {
      event.preventDefault();
      if (
        document.getElementById("walletButton").textContent === "Connect Wallet"
      ) {
        try {
          await connectEthereum();
        } catch (err) {
          console.error("Error connecting to Ethereum:", err);
        }
      } else {
        disconnectEthereum();
      }
    });

  document
    .getElementById("vcForm")
    .querySelector("button")
    .addEventListener("click", issueVC);

  document
    .getElementById("registerPage");
    // .addEventListener("load", getRecentTransactions);
  

  document.querySelector(".menu").addEventListener("click", function (event) {
    if (event.target.tagName === "A") {
      event.preventDefault();
      const targetHref = event.target.getAttribute("href").substr(1);
      if (targetHref === "issueVC") {
        showPage("issueVC");
      } else {
        const pageId = targetHref + "Page";
        showPage(pageId);
      }
    }
  });
});