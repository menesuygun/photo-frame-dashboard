// Export existing device data before enabling household sync. No credentials are exported.
(function(){
 const A=window.App;
 const keys={chores:'frame-chore-templates-v1',completions:'frame-chore-completions-v1',meals:'frame-meals-v1',reminders:'frame-reminders-v1',shopping:'frame-shopping-v1',usuals:'frame-usuals-v1',education:'frame-education-beyza-v1'};
 A.householdBackup=async function(){
  const documents={};
  for(const [category,key] of Object.entries(keys)){const value=localStorage.getItem(key);if(value!==null)documents[category]=JSON.parse(value);}
  const photos=A.exportPhotoRecords?await A.exportPhotoRecords():[];
  const files=[];
  for(const photo of photos){const {blob,...metadata}=photo;const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Could not back up a photo.'));reader.readAsDataURL(blob);});files.push({...metadata,data});}
  return {format:'family-dashboard-backup',version:1,createdAt:new Date().toISOString(),documents,photos:files};
 };
 A.downloadHouseholdBackup=async function(){const backup=await A.householdBackup();const url=URL.createObjectURL(new Blob([JSON.stringify(backup)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='family-dashboard-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);return backup;};
})();
