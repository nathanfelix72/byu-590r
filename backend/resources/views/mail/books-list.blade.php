Hello manager.  Here is the list of books:

<table>
    <thead>
        <tr>
            <th>Title</th>
        </tr>
    </thead>
    <tbody>
        @foreach ($books as $book)
        <tr>
            <td>
                {{ $book->name }} {{ $book->description }}
            </td>
        </tr>    
        @endforeach
       
    </tbody>
</table>

