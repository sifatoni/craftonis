const companyPart = "Junior Teacher Deen K.G & Deen International School";
const regex = /^([A-Z][a-zA-Z]+\s[A-Z][a-zA-Z]+|[A-Z][a-zA-Z]+)\s+((?:[A-Z][a-zA-Z&.]+\s*)*(?:School|Company|Ltd|Inc|Corp|Institute|University|Bank|Group|International|K\.G|K\.G\.|KG).*)/;
const match = companyPart.match(regex);

if (match) {
  console.log("Role:", match[1]);
  console.log("Company:", match[2]);
} else {
  console.log("No match");
}
