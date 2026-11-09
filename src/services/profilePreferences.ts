import { getStaffUser } from './api'

function pictureKey() {
  const user = getStaffUser()
  if (!user) throw new Error('Sign in to manage your profile picture.')
  return `medicare.profile-picture.${user.id}`
}

export function getProfilePicture() {
  const picture = localStorage.getItem(pictureKey())
  if (picture && !picture.startsWith('data:image/jpeg;base64,')) {
    throw new Error('The saved profile picture is invalid. Remove it and upload another image.')
  }
  return picture
}

export function saveProfilePicture(picture: string) {
  if (!picture.startsWith('data:image/jpeg;base64,')) {
    throw new Error('Choose a valid JPEG profile picture.')
  }
  localStorage.setItem(pictureKey(), picture)
}

export function removeProfilePicture() {
  localStorage.removeItem(pictureKey())
}
