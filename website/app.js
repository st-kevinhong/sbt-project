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

async function getRecentTransactions() {
  if (!accounts || accounts.length === 0) {
    alert("Please connect your Ethereum wallet first.");
    return;
  }

  const address = accounts[0];
  const ETHERSCAN_API_KEY = "FVWM4RX3F3KXM5I72CS1BSKKE783M3MXD3"; // 이곳에 Etherscan API 키를 입력하세요.
  const etherscanURL = `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${ETHERSCAN_API_KEY}`;

  try {
    const response = await fetch(etherscanURL);
    const data = await response.json();

    if (data.status !== "1" || !data.result) {
      throw new Error("Failed to fetch transactions.");
    }

    const transactions = data.result.slice(0, 10); // 최근 10개의 트랜잭션만 가져옵니다.

    // UI에 트랜잭션 정보 표시 (예: 테이블 또는 리스트에 추가)
    displayTransactions(transactions);
  } catch (error) {
    console.error("Error fetching transactions:", error);
  }
}

function displayTransactions(transactions) {
  const transactionsTableBody = document.querySelector(
    "#transactionsTable tbody"
  );
  transactionsTableBody.innerHTML = ""; // 기존 행 삭제

  for (const tx of transactions) {
    const row = transactionsTableBody.insertRow();

    const hashCell = row.insertCell(0);
    hashCell.textContent = tx.hash;

    const valueCell = row.insertCell(1);
    valueCell.textContent = web3.utils.fromWei(tx.value, "ether");
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
          const vpJSONBlob = new Blob([JSON.stringify(vpPayload, null, 4)], {
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

// async function signVC(vcData, address) {
//   const vcString = JSON.stringify(vcData);
//   const hashedVC = web3.utils.sha3(vcString);

//   const signature = await web3.eth.personal.sign(hashedVC, address, ""); // 마지막 매개변수는 비밀번호입니다. MetaMask를 사용하는 경우 비밀번호는 필요하지 않습니다.

//   return signature;
// }

// function addSignatureToVC(vc, signature) {
//   vc["proof"] = {
//     type: "EcdsaSecp256k1Signature",
//     created: new Date().toISOString(),
//     proofPurpose: "assertionMethod",
//     verificationMethod: accounts[0], // 현재 Ethereum 주소
//     signature: signature,
//   };
//   return vc;
// }

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
// function downloadVP(data, filename) {
//   const blob = new Blob([JSON.stringify(data, null, 2)], {
//     type: "application/json",
//   });
//   const url = URL.createObjectURL(blob);
//   const a = document.createElement("a");
//   a.href = url;
//   a.download = filename;
//   document.body.appendChild(a);
//   a.click();
//   window.URL.revokeObjectURL(url);
//   document.body.removeChild(a);
// }

function showPage(pageId) {
  const pages = ["issueVC", "viewVCPage", "verifyVPPage", "createVPPage"];
  for (let id of pages) {
    if (id === pageId) {
      document.getElementById(id).style.display = "block";
      // 여기에 로직을 추가
      if (id === "viewVCPage") {
        if (!accounts || accounts.length === 0) {
          alert("Please connect your Ethereum wallet first.");
          return;
        }
        const ownerAddress = accounts[0];
        fetchSBTTokensByOwner(ownerAddress)
          .then((tokens) => {
            displaySBTTokens(tokens);
          })
          .catch((error) => {
            console.error("Error fetching SBT tokens:", error);
          });
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

function verifyVP() {
  // TODO: Add actual verification logic here

  // For this example, we'll simply display "Verified!"
  document.getElementById("verificationResult").textContent = "Verified!";
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
    .getElementById("viewVCPage")
    .addEventListener("load", getRecentTransactions);

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
