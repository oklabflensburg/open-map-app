import csv
import click
import json
import httpx


def read_csv(file_path):
    with open(file_path, mode='r', encoding='utf-8') as csvfile:
        csv_reader = csv.DictReader(csvfile, delimiter=';')
        return [row for row in csv_reader]


def convert_to_json(file_path, csv_data):
    data = []
    with open(file_path, mode='r', encoding='utf-8') as csvfile:
        csv_reader = csv.DictReader(csvfile)

        for row in csv_reader:
            row_copy = row.copy()
            
            # Get list of keys before iteration to avoid RuntimeError
            keys = list(row_copy.keys())

            for key in keys:
                for row_cc in csv_data:
                    if key == 'number' and row_copy[key] == row_cc['number']:
                        row_copy['description'] = row_cc['description']
                        row_copy['measurements'] = row_cc['measurements']
                        row_copy['condition'] = row_cc['condition']
                        break

                if row_copy[key] == '':
                    row_copy[key] = None
                else:
                    row_copy[key] = row_copy[key].strip()
                    
                if key == 'address':
                    addr = f'{row_copy[key]} Flensburg Germany'
                    nominatim_result = get_nominatim_data(addr)
                    if nominatim_result:
                        row_copy['latitude'] = nominatim_result.get('lat')
                        row_copy['longitude'] = nominatim_result.get('lon')
                        print(row_copy['latitude'], row_copy['longitude'])
                    print(row_copy[key])
            data.append(row_copy)

    return data


def get_nominatim_data(address):
    url = "https://nominatim.oklabflensburg.de/search"
    params = {
        'q': address,
        'format': 'json',
        'addressdetails': 1,
        'limit': 1
    }
    response = httpx.get(url, params=params, timeout=30)
    if response.status_code == 200:
        results = response.json()
        if results:
            return results[0]
    return None


@click.command()
@click.argument('file_path')
@click.argument('file_path_culturecadastre')
def main(file_path, file_path_culturecadastre):
    csv_data = read_csv(file_path_culturecadastre)
    data = convert_to_json(file_path, csv_data)
    print(json.dumps(data, ensure_ascii=False, indent=4))


if __name__ == "__main__":
    main()
